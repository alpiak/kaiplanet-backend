import * as dns from "dns";
import * as http from "http";
import * as https from "https";
import { parse, UrlWithStringQuery } from "url";
import * as zlib from "zlib";

import * as ProxyAgent from "proxy-agent";

const REQUEST_TIMEOUT = 1000 * 60 * 2;

export default class RaceManager {
    private static readonly noRaceError = new Error("No race in progress.");
    private static readonly cancelWatchRaceError = new Error("Cancelled watching race.");
    private static readonly requestTimeoutError = new Error("Request timeout.");

    get racerNum() {
        return this.raceTimeouts.length;
    }

    public locationService: any;
    public proxyPool: any = { getProxyList() { return null; } };
    private winnerRequest?: http.ClientRequest;
    private racing = false;
    private racePromise?: Promise<http.IncomingMessage>;
    private resolveRaceWinner?: (res: http.IncomingMessage) => void;
    private rejectWithRaceError?: (err: Error) => void;
    private raceTimeouts: Array<ReturnType<typeof setTimeout>> = [];
    private requestsInRace: http.ClientRequest[] = [];
    private raceErrorRejects: Array<(err?: Error) => void> = [];
    private errorCount: number = 0;
    private lastError?: Error;
    private lastErrorReject?: (err?: Error) => void;
    private cancelWatchRace?: () => void;

    public startRace() {
        this.winnerRequest = undefined;
        this.errorCount = 0;
        this.racePromise = Promise.race([]);
        this.raceTimeouts = [];
        this.requestsInRace = [];
        this.raceErrorRejects = [];
        this.racing = true;

        return new Promise((resolve, reject) => {
            this.resolveRaceWinner = resolve;
            this.rejectWithRaceError = reject;
        });
    }

    public joinRace(urls: string[], timeToWait = 0) {
        if (!this.racePromise) {
            throw RaceManager.noRaceError;
        }

        this.racePromise = Promise.race([this.racePromise, ...(Array.isArray(urls) ? urls : [urls])
            .map((urlStr) => new Promise<http.IncomingMessage>(async (resolve, reject) => {
                try {
                    this.raceTimeouts.push(setTimeout(async () => {
                        const fixedUrl = ((urlToFix) => {
                            if (!/:/.test(urlToFix)) {
                                return "https://" + urlToFix;
                            }

                            return urlToFix;
                        })(urlStr.replace(/^\/+/, "").replace(/\/+$/, ""));

                        const parsedUrl = parse(fixedUrl);

                        const sendRequest = (proxy?: string) => new Promise(async (resolveSend, rejectSend) => {
                            const send = (url: UrlWithStringQuery) => {
                                const client = url.protocol === "https:" ? https : http;

                                const reqHeaders: any = {
                                    host: `${url.host}${(url.port && (":" + url.port)) || ""}`,
                                    origin: `${url.protocol}//${url.host}${(url.port && (":" + url.port)) || ""}`,
                                    referer: `${url.protocol}//${url.host}${(url.port && (":" + url.port)) || ""}/`,
                                };

                                if ((!zlib.createBrotliDecompress || !zlib.createBrotliCompress) && reqHeaders["accept-encoding"]) {
                                    reqHeaders["accept-encoding"] = reqHeaders["accept-encoding"]
                                        .split(",")
                                        .filter((encoding: string) => !/br/.test(encoding))
                                        .join(",");
                                }

                                const options: http.RequestOptions|https.RequestOptions = {
                                    headers: reqHeaders,
                                    host: url.host,
                                    method: "GET",
                                    path: url.path,
                                    port: url.port,
                                    protocol: url.protocol,
                                    rejectUnauthorized: false,
                                };

                                if (proxy) {
                                    // @ts-ignore
                                    options.agent = new ProxyAgent(proxy);
                                }

                                return new Promise<http.IncomingMessage>((resolveRequest, rejectRequest) => {
                                    const targetReq = client.request(options, (res: http.IncomingMessage) => {
                                        const { statusCode } = res;
                                        const success = statusCode && statusCode >= 200 && statusCode < 300;

                                        if (!this.winnerRequest && success) {
                                            this.winnerRequest = targetReq;
                                        }

                                        resolveRequest(res);

                                        if (!this.racing) {
                                            targetReq.abort();
                                        }
                                    });

                                    this.requestsInRace.push(targetReq);
                                    this.raceErrorRejects.push(rejectRequest);

                                    targetReq.on("error", (e: Error) => {
                                        this.errorCount++;
                                        this.lastError = e;
                                        this.lastErrorReject = rejectRequest;
                                    });

                                    targetReq.setTimeout(REQUEST_TIMEOUT, () => {
                                        this.errorCount++;
                                        this.lastError = RaceManager.requestTimeoutError;
                                        this.lastErrorReject = rejectRequest;
                                    });

                                    targetReq.end();
                                });
                            };

                            let targetUrl = parsedUrl;

                            while (true) {
                                const originRes = await send(targetUrl);
                                const { statusCode, headers } = originRes;

                                if (statusCode && statusCode >= 200 && statusCode < 300) {
                                    return resolveSend(originRes);
                                } else if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
                                    targetUrl = parse(headers.location);
                                } else {
                                    this.errorCount++;
                                    this.lastErrorReject = rejectSend;
                                }
                            }
                        });

                        resolve(await Promise.race([sendRequest(), ...await (async () => {
                            if (!this.locationService) {
                                throw new Error("No location service injected.");
                            }

                            const proxies = await (async (url) => {
                                try {
                                    const ip = await new Promise((resolveDnsLookup, rejectDnsLookup) => {
                                        if (!url.host) {
                                            return rejectDnsLookup(new Error("No host in url."));
                                        }

                                        dns.lookup(url.host, (err, address) => {
                                            if (err) {
                                                rejectDnsLookup(err);
                                            }

                                            resolveDnsLookup(address);
                                        });
                                    });

                                    const location = await this.locationService.getLocation(ip);

                                    return this.proxyPool.getRandomProxies(location.areaCode, "all", 3, .5);
                                } catch (e) {
                                    // console.log(e);

                                    return [];
                                }
                            })(parsedUrl);

                            return proxies.map(sendRequest);
                        })()]));

                    }, timeToWait));
                } catch (e) {
                    reject(e);
                }
            }))]);

        this.watchRace();
    }

    public stopJoinRace() {
        if (this.errorCount >= this.raceTimeouts.length && this.lastErrorReject) {
            return this.lastErrorReject(this.lastError);
        }

        this.requestsInRace.forEach((request, i) => {
            request.on("error", (e) => {
                if (this.errorCount >= this.raceTimeouts.length && this.lastErrorReject) {
                    return this.raceErrorRejects[i](e);
                }
            });

            request.setTimeout(REQUEST_TIMEOUT, () => {
                if (this.errorCount >= this.raceTimeouts.length && this.lastErrorReject) {
                    return this.raceErrorRejects[i](RaceManager.requestTimeoutError);
                }
            });
        });
    }

    public stopRace() {
        this.racing = false;

        if (this.cancelWatchRace) {
            this.cancelWatchRace();
        }

        for (const timeout of this.raceTimeouts ) {
            clearTimeout(timeout);
        }

        this.raceTimeouts  = [];

        this.requestsInRace.forEach((request) => {
            if (this.winnerRequest && request === this.winnerRequest) {
                return;
            }

            request.abort();
        });

        this.raceTimeouts = [];
        this.requestsInRace = [];
        this.raceErrorRejects = [];
    }

    private watchRace() {
        if (!this.racePromise) {
            throw RaceManager.noRaceError;
        }

        if (this.cancelWatchRace) {
            this.cancelWatchRace();
        }

        Promise.race([this.racePromise, new Promise<http.IncomingMessage>((resolve, reject) => {
            this.cancelWatchRace = () => reject(RaceManager.cancelWatchRaceError);
        })]).then((res) => {
            this.stopRace();

            if (this.resolveRaceWinner) {
                this.resolveRaceWinner(res);
            }
        }).catch((err) => {
            if (err === RaceManager.cancelWatchRaceError) {
                return;
            }

            this.stopRace();

            if (this.rejectWithRaceError) {
                this.rejectWithRaceError(err);
            }
        });
    }
}
