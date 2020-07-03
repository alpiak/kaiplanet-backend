import * as http from "http";
import * as https from "https";

import * as schedule from "node-schedule";

import ProxyPool from "../../ProxyPool";
import BrowserService from "../BrowserService";

import Area from "./Area";
import Proxy from "./Proxy";
import Status from "./Status";
import TestCase from "./TestCase";
import TestResult from "./TestResult";

import EightNineIpProducer from "./producers/EightNineIpProducer";
import IpHaiProducer from "./producers/IpHaiProducer";
import KuaidailiProducer from "./producers/KuaidailiProducer";
import XiciDailiProducer from "./producers/XiciDailiProducer";

import configDevelopment from "./config/development";
import configProduction from "./config/production";

import { receiveData, request } from "../../libraries/utils";

const config = (() => {
    switch (process.env.NODE_ENV) {
        case "production":
            return configProduction;

        case "development":
        default:
            return configDevelopment;
    }
})();

const Producers = [IpHaiProducer, KuaidailiProducer, EightNineIpProducer, XiciDailiProducer];

export default class ProxyService {
    public static MAX_PROXY_NUM = 64;
    private static PERIOD_TO_REFRESH_PROXY_LIST = config.periodToRefreshProxyList;
    private static FAILURE_TIMES_TO_REMOVE_PROXY = 2;

    private static async test(proxy: Proxy, testCase: TestCase) {
        if (!testCase.areas.has(proxy.area)) {
            throw new Error("Test case is not apply to the area of the proxy location");
        }

        let status = Status.FAILURE;

        const initTimestamp = new Date().getTime();

        let responseTimestamp;
        let endTimestamp;

        const url = new URL(testCase.url);

        if (!url.host && !url.hostname) {
            throw new Error("No host specified in the url of the test case.");
        }

        const res = await request({
            hostname: url.host as string || url.hostname as string,
            method: testCase.method,
            path: url.pathname + url.search,
            port: url.port && url.port.length ? parseInt(url.port, 10) : undefined,
            protocol: url.protocol && url.protocol.length ? url.protocol.replace(/:\S*$/, "") : "https",
            proxy: proxy.toString(),
        });

        responseTimestamp = new Date().getTime();

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            status = Status.FAILURE;
        }

        const responseData = await (async () => {
            try {
                return await receiveData(res);
            } catch (e) {
                // console.log(e);
            }
        })();

        if (responseData && responseData.compare(testCase.originResponse) === 0) {
            status = Status.SUCCESS;
            endTimestamp = new Date().getTime();
        } else {
            status = Status.FAILURE;
        }

        const responseTime = (() => {
            if (status === Status.SUCCESS && responseTimestamp) {
                return responseTimestamp - initTimestamp;
            }

            return null;
        })();

        const speed = (() => {
            if (responseData && status === Status.SUCCESS && endTimestamp && responseTimestamp) {
                return responseData.byteLength / (endTimestamp - responseTimestamp);
            }

            return null;
        })();

        return new TestResult(status, responseTime, speed);
    }

    public browserService!: BrowserService;
    public proxyPool!: ProxyPool;

    private proxies = new Map(Area.values().map((area) => [area, new Set<Proxy>()]));

    private testCases = config.testCases
        .map(({ url, method, areas }: any) => new TestCase(url, method, areas.map((a: any) => Area.fromCode(a))));

    private scheduleJobRunning = false;

    constructor() {
        schedule.scheduleJob(`*/${ProxyService.PERIOD_TO_REFRESH_PROXY_LIST} * * * * ?`, async () => {
            if (this.scheduleJobRunning) {
                return;
            }

            this.scheduleJobRunning = true;

            try {
                await this.refreshProxyList();
            } catch (e) {
                // console.log(e);
            }

            this.scheduleJobRunning = false;
        });
    }

    public getProxyList(areaCode = "GLOBAL", protocol = "all", sortBy = "responseTime") {
        const area = Area.fromCode(areaCode.toUpperCase());

        if (!area) {
            return;
        }

        return [...(this.proxies.get(area) || [])].filter((proxy) => {
            if (protocol === "http" || protocol === "https") {
                return proxy.protocol === protocol;
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === "responseTime") {
                return a.historyResponseTime.reduce((total, h) => total + h) / a.historyResponseTime.length
                    - b.historyResponseTime.reduce((total, h) => total + h) / a.historyResponseTime.length;
            } else if (sortBy === "speed") {
                return a.historySpeed.reduce((total, h) => total + h) / a.historyResponseTime.length
                    - b.historySpeed.reduce((total, h) => total + h) / a.historyResponseTime.length;
            }

            return 0;
        }).map((proxy) => `${proxy.protocol}://${proxy.host}:${proxy.port}`);
    }

    private async refreshProxyList() {
        const maxProxyNum = ProxyService.MAX_PROXY_NUM;

        for (const [area, proxies] of this.proxies.entries()) {
            await this.testExistingProxiesAndRemoveBrokenOnes(proxies);

            if (proxies.size >= maxProxyNum) {
                continue;
            }

            for (const Producer of Producers) {
                if (!Producer.areas.has(area)) {
                    continue;
                }

                const instances = Producer.instances;

                if (instances) {
                    if (instances.length) {
                        for (const { host, port, protocol, path } of instances) {
                            if (proxies.size >= maxProxyNum) {
                                continue;
                            }

                            const producer = new Producer(host, port, protocol, { path });

                            producer.browserService = this.browserService;
                            producer.proxyPool = this.proxyPool;

                            try {
                                const fetchedProxies =
                                    await producer.fetchProxyList(maxProxyNum - proxies.size, area);

                                await this.testAndAddNewProxies(fetchedProxies);
                            } catch (e) {
                                // console.log(e);
                            }
                        }
                    }
                } else {
                    if (proxies.size >= ProxyService.MAX_PROXY_NUM) {
                        continue;
                    }

                    const producer = new Producer();

                    producer.browserService = this.browserService;
                    producer.proxyPool = this.proxyPool;

                    try {
                        const fetchedProxies = await producer.fetchProxyList(maxProxyNum - proxies.size, area);

                        await this.testAndAddNewProxies(fetchedProxies);
                    } catch (e) {
                        // console.log(e);
                    }
                }
            }
        }
    }

    private async testExistingProxiesAndRemoveBrokenOnes(proxies: Set<Proxy>) {
        for (const testCase of this.testCases) {
            try {
                await testCase.refreshOriginResponse();
            } catch { /**/ }
        }

        for (const proxy of proxies) {
            try {
                const testResults = await Promise.all(this.testCases.filter((testCase) => testCase.valid)
                    .map((testCase) => ProxyService.test(proxy, testCase)));

                if (testResults.filter((testResult) => !testResult).length) {
                    proxy.failureTimes++;

                    if (proxy.failureTimes >= ProxyService.FAILURE_TIMES_TO_REMOVE_PROXY) {
                        proxies.delete(proxy);
                    }

                    continue;
                }

                if (testResults.filter((testResult) => testResult.status !== Status.SUCCESS).length) {
                    proxy.failureTimes++;

                    if (proxy.failureTimes >= ProxyService.FAILURE_TIMES_TO_REMOVE_PROXY) {
                        proxies.delete(proxy);
                    }

                    continue;
                }

                proxy.failureTimes = 0;

                testResults.forEach((testResult) => {
                    if (typeof testResult.responseTime !== "undefined") {
                        proxy.recordResponseTime(testResult.responseTime);
                    }

                    if (typeof testResult.speed !== "undefined") {
                        proxy.recordSpeed(testResult.speed);
                    }
                });
            } catch (e) {
                // console.log(e);
            }
        }
    }

    private async testAndAddNewProxies(newProxies: Proxy[]) {
        for (const testCase of this.testCases) {
            try {
                await testCase.refreshOriginResponse();
            } catch { /**/ }
        }

        for (const newProxy of newProxies) {
            try {
                const testResults = await Promise.all(this.testCases.filter((testCase) => testCase.valid)
                    .map((testCase) => ProxyService.test(newProxy, testCase)));

                if (!testResults.filter((testResult) => testResult).length) {
                    continue;
                }

                if (!testResults.filter((testResult) => testResult.status === Status.SUCCESS).length) {
                    continue;
                }

                const existingProxies = this.proxies.get(newProxy.area);

                if (!existingProxies) {
                    try {
                        throw  new Error("The region of the new proxy is not supported.");
                    } catch (e) {
                        // console.log(e);

                        continue;
                    }
                }

                if (existingProxies.size > ProxyService.MAX_PROXY_NUM) {
                    continue;
                }

                const proxy = (() => {
                    for (const existingProxy of existingProxies) {
                        if (existingProxy.equals(newProxy)) {
                            return existingProxy;
                        }
                    }

                    existingProxies.add(newProxy);

                    return newProxy;
                })();

                testResults.forEach((testResult) => {
                    if (testResult.responseTime) {
                        proxy.recordResponseTime(testResult.responseTime);
                    }

                    if (testResult.speed) {
                        proxy.recordSpeed(testResult.speed);
                    }
                });
            } catch (e) {
                // console.log(e);
            }
        }
    }
}
