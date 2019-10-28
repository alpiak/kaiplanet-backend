const http = require("http");
const https = require("https");
const url = require("url");
const zlib = require("zlib");
const dns = require("dns");

const ProxyAgent = require("proxy-agent");

const REQUEST_TIMEOUT = 1000 * 60 * 2;

module.exports = () => class RaceManager {
    static _noRaceError = new Error("No race in progress.");
    static _cancelWatchRaceError = new Error("Cancelled watching race.");
    static _requestTimeoutError = new Error("Request timeout.");

    set locationService(locationService) {
        this._locationService = locationService;
    }

    set proxyPool(proxyPool) {
        this._proxyPool = proxyPool;
    }

    get racerNum() {
        return this._raceTimeouts.length;
    }

    _locationService;
    _proxyPool = { getProxyList() { return null; } };
    _winnerRequest;
    _racing;
    _racePromise;
    _resolveRaceWinner;
    _rejectWithRaceError;
    _raceTimeouts = [];
    _requestsInRace = [];
    _raceErrorRejects = [];
    _errorCount;
    _lastError;
    _lastErrorReject;
    _cancelWatchRace;

    startRace() {
        this._winnerRequest = undefined;
        this._errorCount = 0;
        this._racePromise = Promise.race([]);
        this._raceTimeouts = [];
        this._requestsInRace = [];
        this._raceErrorRejects = [];
        this._racing = true;

        return new Promise((resolve, reject) => {
            this._resolveRaceWinner = resolve;
            this._rejectWithRaceError = reject;
        });
    }

    joinRace(urls, timeToWait = 0) {
        if (!this._racePromise) {
            throw RaceManager._noRaceError;
        }

        this._racePromise = Promise.race([this._racePromise, ...(Array.isArray(urls) ? urls : [urls])
            .map((urlStr) => new Promise(async (resolve, reject) => {
                try {
                    this._raceTimeouts.push(setTimeout(async () => {
                        const fixedUrl = ((urlStr) => {
                            if (!/:/.test(urlStr)) {
                                return "https://" + urlStr;
                            }

                            return urlStr;
                        })(urlStr.replace(/^\/+/, "").replace(/\/+$/, ""));

                        const parsedUrl = url.parse(fixedUrl);

                        const sendRequest = (proxy) => new Promise(async (resolve, reject) => {
                            const send = (url) => {
                                const client = url.protocol === "https:" ? https : http;

                                const reqHeaders = {
                                    "host": `${url.host}${(url.port && (":" + url.port)) || ""}`,
                                    "origin": `${url.protocol}//${url.host}${(url.port && (":" + url.port)) || ""}`,
                                    "referer": `${url.protocol}//${url.host}${(url.port && (":" + url.port)) || ""}/`,
                                };

                                if ((!zlib.createBrotliDecompress || !zlib.createBrotliCompress) && reqHeaders["accept-encoding"]) {
                                    reqHeaders["accept-encoding"] = reqHeaders["accept-encoding"]
                                        .split(",")
                                        .filter((encoding) => !/br/.test(encoding))
                                        .join(",");
                                }

                                const options = {
                                    method: "GET",
                                    protocol: url.protocol,
                                    host: url.host,
                                    port: url.port,
                                    path: url.path,
                                    headers: reqHeaders,
                                    rejectUnauthorized: false
                                };

                                if (proxy) {
                                    options.agent = new ProxyAgent(proxy);
                                }

                                return new Promise((resolve, reject) => {
                                    const targetReq = client.request(options, (res) => {
                                        if (!this._winnerRequest && res.statusCode >= 200 && res.statusCode < 300) {
                                            this._winnerRequest = targetReq;
                                        }

                                        resolve(res);

                                        if (!this._racing) {
                                            targetReq.abort();
                                        }
                                    });

                                    this._requestsInRace.push(targetReq);
                                    this._raceErrorRejects.push(reject);

                                    targetReq.on("error", (e) => {
                                        this._errorCount++;
                                        this._lastError = e;
                                        this._lastErrorReject = reject;
                                    });

                                    targetReq.setTimeout(REQUEST_TIMEOUT, () => {
                                        this._errorCount++;
                                        this._lastError = RaceManager._requestTimeoutError;
                                        this._lastErrorReject = reject;
                                    });

                                    targetReq.end();
                                });
                            };

                            let targetUrl = parsedUrl;

                            while (true) {
                                const originRes = await send(targetUrl);

                                if (originRes.statusCode >= 200 && originRes.statusCode < 300) {
                                    return resolve(originRes);
                                } else if (originRes.statusCode >= 300 && originRes.statusCode < 400 && originRes.headers.location) {
                                    targetUrl = url.parse(originRes.headers.location);
                                } else {
                                    this._errorCount++;
                                    this._lastErrorReject = reject;
                                }
                            }
                        });

                        resolve(await Promise.race([sendRequest(), ...await (async () => {
                            if (!this._locationService) {
                                throw new Error("No location service injected.");
                            }

                            const proxies = await (async (url) => {
                                try {
                                    const ip = await new Promise((resolve, reject) => {
                                        dns.lookup(url.host, (err, address) => {
                                            if (err) {
                                                reject(err);
                                            }

                                            resolve(address);
                                        });
                                    });

                                    const location = await this._locationService.getLocation(ip);

                                    return this._proxyPool.getRandomProxies(location.areaCode, "all", 3, .5);
                                } catch (e) {
                                    console.log(e);

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

        this._watchRace();
    }

    stopJoinRace() {
        if (this._errorCount >= this._raceTimeouts.length && this._lastErrorReject) {
            return this._lastErrorReject(this._lastError);
        }

        this._requestsInRace.forEach((request, i) => {
            request.on("error", (e) => {
                if (this._errorCount >= this._raceTimeouts.length && this._lastErrorReject) {
                    return this._raceErrorRejects(e);
                }
            });

            request.setTimeout(REQUEST_TIMEOUT, () => {
                if (this._errorCount >= this._raceTimeouts.length && this._lastErrorReject) {
                    return this._raceErrorRejects[i](RaceManager._requestTimeoutError);
                }
            });
        })
    }

    stopRace() {
        this._racing = false;

        if (this._cancelWatchRace) {
            this._cancelWatchRace();
        }

        for (const timeout of this._raceTimeouts ) {
            clearTimeout(timeout);
        }

        this._raceTimeouts  = [];

        this._requestsInRace.forEach((request) => {
            if (this._winnerRequest && request === this._winnerRequest) {
                return;
            }

            request.abort();
        });

        this._raceTimeouts = [];
        this._requestsInRace = [];
        this._raceErrorRejects = [];
    }

    _watchRace() {
        if (!this._racePromise) {
            throw RaceManager._noRaceError;
        }

        if (this._cancelWatchRace) {
            this._cancelWatchRace();
        }

        Promise.race([this._racePromise, new Promise((resolve, reject) => {
            this._cancelWatchRace = () => reject(RaceManager._cancelWatchRaceError);
        })]).then((res) => {
            this.stopRace();
            this._resolveRaceWinner(res);
        }).catch((err) => {
            if (err === RaceManager._cancelWatchRaceError) {
                return;
            }

            this.stopRace();
            this._rejectWithRaceError(err);
        });
    }
};
