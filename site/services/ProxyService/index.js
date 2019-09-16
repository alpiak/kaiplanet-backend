const http = require("http");
const https = require("https");

const schedule = require("node-schedule");

const Status = require("./Status")();
const Area = require("./Area")();
const TestCase = require("./TestCase")({ Area });
const TestResult = require("./TestResult")();
const Proxy = require("./Proxy")({ Area });
const Producer = require("./producers/Producer")({ Area });

module.exports = (env = "development") => {
    const config = require(`./config/${env}`);
    const IpHaiProducer = require("./producers/IpHaiProducer")({ Area, Proxy, Producer, config });
    const XiciDailiProducer = require("./producers/XiciDailiProducer")({ Area, Proxy, Producer, config });
    const KuaidailiProducer = require("./producers/KuaidailiProducer")({ Area, Proxy, Producer, config });
    const EightNineIpProducer = require("./producers/EightNineIpProducer")({ Area, Proxy, Producer, config });

    return class ProxyService {
        static PERIOD_TO_REFRESH_PROXY_LIST = config.periodToRefreshProxyList;
        static MAX_PROXY_NUM = 64;
        static FAILURE_TIMES_TO_REMOVE_PROXY = 2;

        static async test(proxy, testCase) {
            if (!testCase.areas.has(proxy.area)) {
                throw new Error("Test case is not apply to the area of the proxy location");
            }

            let data = Buffer.from("");
            let status = Status.FAILURE;

            const initTimestamp = new Date().getTime();

            let responseTimestamp;
            let endTimestamp;

            await new Promise((resolve, reject) => {
                try {
                    const client = (() => {
                        switch (proxy.protocol) {
                            case "http":
                                return http;
                            case "https":
                            default:
                                return https;
                        }
                    })();

                    const req = client.request({
                        host: proxy.host,
                        port: proxy.port,
                        method: testCase.method,
                        path: testCase.url
                    }, (res) => {
                        if (res.statusCode < 200 && res.statusCode >= 300) {
                            status = Status.FAILURE;

                            resolve();
                        }

                        responseTimestamp = new Date().getTime();

                        res.on("data", (chunk) => {
                            data = Buffer.concat([data, chunk]);
                        });

                        res.on("end", () => {
                            if (data.compare(testCase.originResponse) === 0) {
                                status = Status.SUCCESS;
                                endTimestamp = new Date().getTime();
                            } else {
                                status = Status.FAILURE;
                            }

                            resolve();
                        });

                    }).on('error', () => {
                        status = Status.FAILURE;

                        resolve();
                    });

                    req.end();
                } catch (e) {
                    reject(e);
                }
            });

            const responseTime = (() => {
                if (status === Status.SUCCESS && responseTimestamp) {
                    return responseTimestamp - initTimestamp;
                }

                return null;
            })();

            const speed = (() => {
                if (status === Status.SUCCESS && endTimestamp && responseTimestamp) {
                    return data.byteLength / (endTimestamp - responseTimestamp);
                }

                return null;
            })();

            return new TestResult(status, responseTime, speed);
        }

        _Producers = [IpHaiProducer, KuaidailiProducer, EightNineIpProducer, XiciDailiProducer];
        _proxies = new Map(Area.values().map((area) => [area, new Set()]));
        _testCases = config.testCases.map((testCase) => new TestCase(testCase.url, testCase.method, testCase.areas.map((area) => Area.fromCode(area))));

        constructor() {
            schedule.scheduleJob(`*/${ProxyService.PERIOD_TO_REFRESH_PROXY_LIST} * * * *`, async () => {
                try {
                    await this._refreshProxyList();
                } catch (e) {
                    console.log(e);
                }
            });
        }

        getProxyList(areaCode = "GLOBAL", protocol = "all", sortBy = "responseTime") {
            return [...this._proxies.get(Area.fromCode(areaCode.toUpperCase()))].filter((proxy) => {
                if (protocol === "http" || protocol === "https") {
                    return proxy.protocol === protocol;
                }

                return true;
            }).sort((a, b) => {
                if (sortBy === "responseTime") {
                    return a.historyResponseTime.reduce((total, responseTime) => total + responseTime) / a.historyResponseTime.length
                        - b.historyResponseTime.reduce((total, responseTime) => total + responseTime) / a.historyResponseTime.length;
                } else if (sortBy === "speed") {
                    return a.historySpeed.reduce((total, responseTime) => total + responseTime) / a.historyResponseTime.length
                        - b.historySpeed.reduce((total, responseTime) => total + responseTime) / a.historyResponseTime.length;
                }

                return 0;
            }).map((proxy) => `${proxy.protocol}://${proxy.host}:${proxy.port}`);
        }

        async _refreshProxyList() {
            for (const [area, proxies] of this._proxies.entries()) {
                await this._testExistingProxiesAndRemoveBrokenOnes(proxies);

                if (proxies.size >= ProxyService.MAX_PROXY_NUM) {
                    continue;
                }

                for (const Producer of this._Producers) {
                    if (!Producer.areas.has(area)) {
                        continue;
                    }

                    if (Producer.getInstances) {
                        const instances = Producer.getInstances();

                        if (instances && instances.length) {
                            for (const instance of instances) {
                                if (proxies.size >= ProxyService.MAX_PROXY_NUM) {
                                    continue;
                                }

                                const producer = new Producer(instance.host, instance.port, instance.protocol, instance.path);

                                try {
                                    const fetchedProxies = await producer.fetchProxyList(ProxyService.MAX_PROXY_NUM - this._proxies.get(area).size, area, proxies[Math.floor(proxies.length * Math.random())]);

                                    await this._testAndAddNewProxies(fetchedProxies);
                                } catch (e) {
                                    console.log(e);
                                }
                            }
                        }
                    } else {
                        if (proxies.size >= ProxyService.MAX_PROXY_NUM) {
                            continue;
                        }

                        const producer = new Producer();

                        try {
                            const fetchedProxies = await producer.fetchProxyList(ProxyService.MAX_PROXY_NUM - this._proxies.get(area).size, area, proxies[Math.floor(proxies.length * Math.random())]);

                            await this._testAndAddNewProxies(fetchedProxies);
                        } catch (e) {
                            console.log(e);
                        }
                    }
                }
            }
        }

        async _testExistingProxiesAndRemoveBrokenOnes(proxies) {
            for (const testCase of this._testCases) {
                await testCase.refreshOriginResponse();
            }

            for (const proxy of proxies) {
                try {
                    const testResults = await Promise.all(this._testCases.filter((testCase) => testCase.valid).map((testCase) => ProxyService.test(proxy, testCase)));

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
                        proxy.recordResponseTime(testResult.responseTime);
                        proxy.recordSpeed(testResult.speed);
                    });
                } catch (e) {
                    console.log(e);
                }
            }
        }

        async _testAndAddNewProxies(newProxies) {
            for (const testCase of this._testCases) {
                await testCase.refreshOriginResponse();
            }

            for (const newProxy of newProxies) {
                try {
                    const testResults = await Promise.all(this._testCases.filter((testCase) => testCase.valid).map((testCase) => ProxyService.test(newProxy, testCase)));

                    if (testResults.filter((testResult) => !testResult).length) {
                        continue;
                    }

                    if (testResults.filter((testResult) => testResult.status !== Status.SUCCESS).length) {
                        continue;
                    }

                    const existingProxies = this._proxies.get(newProxy.area);

                    if (existingProxies.size > ProxyService.MAX_PROXY_NUM) {
                        continue;
                    }

                    const proxy = (() => {
                        for(const existingProxy of existingProxies) {
                            if (existingProxy.equals(newProxy)) {
                                return existingProxy;
                            }
                        }

                        existingProxies.add(newProxy);

                        return newProxy;
                    })();

                    testResults.forEach((testResult) => {
                        proxy.recordResponseTime(testResult.responseTime);
                        proxy.recordSpeed(testResult.speed);
                    });
                } catch (e) {
                    console.log(e);
                }
            }
        }
    };
};