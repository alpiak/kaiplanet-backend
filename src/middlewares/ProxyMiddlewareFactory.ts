import * as dns from "dns";
import * as http from "http";
import * as https from "https";
import { Transform, TransformCallback, TransformOptions } from "stream";
import * as url from "url";
import * as zlib from "zlib";

import { NextFunction, Request, Response } from "express";
import * as ProxyAgent from "proxy-agent";

// @ts-ignore
import { pipe } from "mississippi";

import * as contentRange from "content-range";

import ICreateMiddleware from "./ICreateMiddleware";

import ProxyPool from "../ProxyPool";

const REQUEST_TIMEOUT = 1000 * 60 * 2;
const REF_REGEXP = "(?:href|src|action)=\"\\s*((?:\\S|\\s)*?)\"";
const ONLY_PATH_REGEXP = "(?:^\\/$|^\\/[^\\/]|^[^\\/]*$)";
const NO_PROTOCOL_REGEXP = "^\\/{2,}";
const HEAD_START_REGEXP = "<html(?:\\S|\\s)*?>\\s*?<head(?:\\S|\\s)*?>";

const parseBase64 = (str: string) => Buffer.from(str, "base64").toString("ascii").replace("&amp;", "&");
const base64Encrypt = (str: string) => Buffer.from(str).toString("base64");

interface ITransformHTMLOptions extends TransformOptions {
    protocol?: string;
    host?: string;
    path?: string;
    proxyBaseURL: string;
}

class TransformHTML extends Transform {
    private static LOCATION_REPLACE_PROXY_METHOD_NAME = "locationReplace";
    private static refRegExp = new RegExp(REF_REGEXP, "g");
    private static noProtocolRegExp = new RegExp(NO_PROTOCOL_REGEXP);

    private readonly protocol?: string;
    private readonly host?: string;
    private readonly path?: string;
    private readonly proxyBaseURL: string;
    private lastChunk: string;
    private firstChunkProcessed = false;

    constructor(options: ITransformHTMLOptions) {
        super(options);

        this.lastChunk = "";

        const { protocol, host, path, proxyBaseURL } = options;

        this.protocol = protocol;
        this.host = host;
        this.path = path;
        this.proxyBaseURL = proxyBaseURL;
    }

    public _transform(currentChunk: Buffer, encoding: string, callback: TransformCallback) {
        if (this.lastChunk.length === 0) {
            this.lastChunk = currentChunk.toString("utf8");

            return callback();
        }

        const lastChunkLength = this.lastChunk.length;
        const chunk = this.fixHtml(this.lastChunk + currentChunk.toString("utf8"));

        this.push(chunk.slice(0, lastChunkLength));
        this.lastChunk = chunk.slice(lastChunkLength);

        callback();
    }

    public _flush(callback: TransformCallback) {
        this.push(this.fixHtml(this.lastChunk));

        callback();
    }

    private fixHtml(chunk: string) {
        chunk = chunk.replace("location.replace", TransformHTML.LOCATION_REPLACE_PROXY_METHOD_NAME);

        const PROXIED_REGEXP = `^${this.proxyBaseURL.replace(/\//g, "\\/")}`;

        while (true) {
            const result = TransformHTML.refRegExp.exec(chunk);

            if (!result) {
                break;
            }

            if (result[1] && !new RegExp(PROXIED_REGEXP).test(result[1])) {
                let fixedUrl = result[1];

                if (new RegExp(ONLY_PATH_REGEXP).exec(fixedUrl)) {
                    if (!/^\//.test(fixedUrl)) {
                        fixedUrl = `${this.path}/${fixedUrl}`;
                    }

                    fixedUrl = `${this.protocol}//${this.host}` + fixedUrl;
                }

                if (TransformHTML.noProtocolRegExp.exec(result[1])) {
                    fixedUrl = fixedUrl.replace(TransformHTML.noProtocolRegExp,  `${this.protocol}//`);
                }

                fixedUrl = fixedUrl.replace(/^\/+/, "");
                fixedUrl = this.proxyBaseURL + base64Encrypt(fixedUrl);

                chunk = chunk.slice(0, result.index) + result[0].replace(result[1], fixedUrl) +
                    chunk.slice(result.index + result[0].length);

                TransformHTML.refRegExp.lastIndex += fixedUrl.length - result[1].length;
            }
        }

        const interpolatedScript = `<!---->
            <script type="text/javascript">
                (function() {
                    function fixUrl(url) {
                        var fixedUrl = url;

                        fixedUrl = fixedUrl.replace(/${NO_PROTOCOL_REGEXP}/, "${this.protocol}//");
                        fixedUrl = fixedUrl.replace(new RegExp("^" + location.origin), "");

                        if(/${PROXIED_REGEXP}/.test(fixedUrl) || url === "about:blank") {
                            return url;
                        }

                        if (/${ONLY_PATH_REGEXP}/.test(fixedUrl)) {
                            fixedUrl = "${this.protocol}//${this.host}" + fixedUrl;
                        }

                        if (/^(?:http:|https:)/.test(fixedUrl)) {
                            fixedUrl = "${this.proxyBaseURL}" + (function() {
                                if (window["btoa"]) {
                                    return btoa(fixedUrl);
                                }

                                return fixedUrl;
                            })();
                        }

                        return fixedUrl;
                    }

                    function proxyMethod(object, methodName, getProxy) {
                        var originMethod = object[methodName];

                        object[methodName] = getProxy(originMethod);
                    };

                    proxyMethod(XMLHttpRequest.prototype, "open", function(originMethod) {
                        return function() {
                            arguments[1] = fixUrl(arguments[1]);

                            return originMethod.apply(this, arguments);
                        }
                    });

                    proxyMethod(window, "fetch", function(originMethod) {
                        return function() {
                            arguments[0] = fixUrl(arguments[0]);

                            return originMethod.apply(this, arguments);
                        }
                    });

                    function getHTMLElementMethodProxy(originMethod) {
                        function fixRef(element) {
                            if (element && typeof element.href === "string") {
                                element.href = fixUrl(element.href);
                            }

                            if (element && typeof element.src === "string") {
                                element.src = fixUrl(element.src);
                            }

                            var childNodes = element.childNodes;

                            if (childNodes) {
                                var i, len;

                                for (i = 0, len = childNodes.length; i < len; i++) {
                                    if (childNodes[i].nodeType === 1) {
                                        fixRef(childNodes[i]);
                                    }
                                }
                            }
                        }

                        return function() {
                            fixRef(arguments[0]);

                            return originMethod.apply(this, arguments);
                        }
                    }

                    proxyMethod(HTMLElement.prototype, "appendChild", getHTMLElementMethodProxy);
                    proxyMethod(HTMLElement.prototype, "insertBefore", getHTMLElementMethodProxy);

                    window["${TransformHTML.LOCATION_REPLACE_PROXY_METHOD_NAME}"] = function(url) {
                        return window.location.replace(fixUrl(url));
                    };

                    if (window.history) {
                        function editHistoryMethodProxy(originMethod) {
                            return function() {
                                arguments[2] = fixUrl(arguments[2]);

                                return originMethod.apply(this, arguments);
                            }
                        }

                        proxyMethod(window.history, "pushState", editHistoryMethodProxy);
                        proxyMethod(window.history, "replaceState", editHistoryMethodProxy);
                    }

                    var href = location.href;

                    window.addEventListener("load", function() {
                        history.replaceState(null, null, href);

                        var anchors = document.getElementsByTagName("a");
                        var i, len;

                        for (i = 0, len = anchors.length; i < len; i++) {
                            anchors[i].href = fixUrl(anchors[i].href);
                        }
                    });
                })()
            </script>
        `;

        const headStartResult = new RegExp(HEAD_START_REGEXP).exec(chunk);

        if (!this.firstChunkProcessed) {
            this.firstChunkProcessed = true;

            if (!/<!DOCTYPE html/.test(chunk) && headStartResult) {
                chunk = interpolatedScript + chunk;
            }

        }

        if (headStartResult) {
            chunk = chunk.slice(0, headStartResult.index + headStartResult[0].length) + interpolatedScript
                + chunk.slice(headStartResult.index + headStartResult[0].length);
        }

        return chunk;
    }
}

interface IProxyMiddlewareFactoryOptions {
    proxyPool: ProxyPool;
    cacheService: any;
    locationService: any;
}

export default class ProxyMiddlewareFactory implements ICreateMiddleware { // tslint:disable-line
    private proxyPool: ProxyPool;
    private cacheService: any;
    private locationService: any;

    constructor({ proxyPool, cacheService, locationService }: IProxyMiddlewareFactoryOptions) {
        this.proxyPool = proxyPool;
        this.cacheService = cacheService;
        this.locationService = locationService;
    }

    public createMiddleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            let aborted = false;

            try {
                const urlStr = req.url.split("?")[0];
                const parsedUrlStr = parseBase64(urlStr.replace(/^\/+/, "").replace(/\/+$/, ""));

                let targetUrlStr;

                if (/\./.test(urlStr) || /:/.test(urlStr)) {
                    targetUrlStr = urlStr;
                } else if (/\./.test(parsedUrlStr) || /:/.test(parsedUrlStr)) {
                    targetUrlStr = parsedUrlStr;
                } else {
                    return next();
                }

                const fixedUrlStr = ((urlToFix) => {
                    if (!/:/.test(urlToFix)) {
                        return "https://" + urlToFix;
                    }

                    return urlToFix;
                })(targetUrlStr.replace(/^\/+/, "").replace(/\/+$/, ""));

                const targetUrl = url.parse(fixedUrlStr);

                const reqHeaders: http.OutgoingHttpHeaders = {
                    ...req.headers,
                    host: `${targetUrl.host}${(targetUrl.port && (":" + targetUrl.port)) || ""}`,
                    origin: `${targetUrl.protocol}//${targetUrl.host}${(targetUrl.port && (":" + targetUrl.port)) || ""}`,
                    referer: `${targetUrl.protocol}//${targetUrl.host}${(targetUrl.port && (":" + targetUrl.port)) || ""}/`,
                };

                const reqsInRace: http.ClientRequest[] = [];

                req.on("close", () => {
                    aborted = true;

                    reqsInRace.forEach((r) => r.destroy());
                });

                let raceEnded = false;

                const originRes = await (async () => {
                    if (this.cacheService.exists(targetUrl.href)) {
                        try {
                            return this.cacheService.get(targetUrl.href);
                        } catch (e) {
                            // console.log(e);
                        }
                    }

                    let proxies: string[]|undefined;
                    let failCount = 0;

                    const sendRequest = (proxy?: string) => new Promise<http.IncomingMessage>((resolve, reject) => {
                        const client = targetUrl.protocol === "https:" ? https : http;
                        const acceptEncoding = reqHeaders["accept-encoding"];

                        if ((!zlib.createBrotliDecompress || !zlib.createBrotliCompress) && acceptEncoding) {
                            if (typeof acceptEncoding === "string") {
                                reqHeaders["accept-encoding"] = acceptEncoding.split(",")
                                    .filter((encoding) => !/br/.test(encoding))
                                    .join(",");

                                return;
                            }

                            if (Array.isArray(acceptEncoding)) {
                                reqHeaders["accept-encoding"] = acceptEncoding.filter((e) => !/br/.test(e));

                                return;
                            }
                        }

                        const options: https.RequestOptions = {
                            headers: reqHeaders,
                            host: targetUrl.host,
                            hostname: targetUrl.hostname,
                            method: req.method,
                            path: targetUrl.path,
                            port: targetUrl.port,
                            protocol: targetUrl.protocol,
                            rejectUnauthorized: false,
                        };

                        if (proxy) {
                            // @ts-ignore
                            options.agent = new ProxyAgent(proxy);
                        }

                        const targetReq: http.ClientRequest = client.request(options, (resInRace) => {
                            if (raceEnded) {
                                return targetReq.destroy();
                            }

                            resolve(resInRace);

                            for (const reqInRace of reqsInRace) {
                                if (reqInRace !== targetReq) {
                                    reqInRace.destroy();
                                }
                            }
                        });

                        reqsInRace.push(targetReq);

                        targetReq.on("error", (e) => {
                            failCount++;

                            if (!proxies || failCount >= proxies.length + 1) {
                                reject(e);
                            }
                        });

                        targetReq.setTimeout(REQUEST_TIMEOUT, () => {
                            failCount++;

                            if (!proxies || failCount >= proxies.length + 1) {
                                reject(new Error("Request timeout."));
                                targetReq.destroy();
                            }
                        });

                        pipe(req, targetReq, (err: Error) => {
                            if (err) {
                                return reject(err);
                            }
                        });
                    });

                    // @ts-ignore
                    return await Promise.any([sendRequest(), Promise.any(await (async () => {
                        proxies = await (async (urlToGetProxiesFor) => {
                            try {
                                const ip = await new Promise((resolve, reject) => {
                                    if (!urlToGetProxiesFor.hostname) {
                                        throw new Error("No hostname specified in the uri to proxy.");
                                    }

                                    dns.lookup(urlToGetProxiesFor.hostname, (err, address) => {
                                        if (err) {
                                            reject(err);
                                        }

                                        resolve(address);
                                    });
                                });

                                const location = await this.locationService.getLocation(ip);

                                return this.proxyPool.getRandomProxies(location.areaCode, "all", 3, .5);
                            } catch (e) {
                                // console.log(e);

                                return [];
                            }
                        })(targetUrl);

                        if (aborted) {
                            return [];
                        }

                        return proxies ? proxies.map(sendRequest) : [];
                    })())]);
                })() as http.IncomingMessage;

                raceEnded = true;

                const cache = originRes.headers["cache-control"] !== "no-cache";
                const { statusCode, headers } = originRes;

                let deleteCacheTimeout: ReturnType<typeof setTimeout>;

                const needCache = cache && !this.cacheService.exists(targetUrl.href)
                    && statusCode && statusCode >= 200 && statusCode < 300;

                if (needCache) {
                    const fullData = (() => {
                        const contentRangeHeader = headers["content-range"];

                        if (statusCode === 206 && contentRangeHeader) {
                            const parts = contentRange.parse(contentRangeHeader);

                            if (parts) {
                                if (parts.first === 0 && parts.length && parts.last === parts.length - 1) {
                                    return true;
                                }
                            }

                            return false;
                        }

                        return true;
                    })();

                    if (fullData) {
                        (async () => {
                            req.on("close", () => {
                                deleteCacheTimeout = setTimeout(() => {
                                    this.cacheService.delete(targetUrl.href);
                                }, 0);
                            });

                            try {
                                await this.cacheService.cache(targetUrl.href, originRes);
                            } catch (e) {
                                // console.log(e);
                            }
                        })();
                    } else {
                        const cacheReqHeaders = { ...reqHeaders };

                        delete cacheReqHeaders.range;

                        (async () => {
                            // try {
                            //     await this.cacheService
                            //       .cache(targetUrl.href, await this.cacheService.sendRequest(targetUrl, req.method, {
                            //             headers: cacheReqHeaders,
                            //         }));
                            // } catch (e) {
                            //     console.log(e);
                            // }
                        })();
                    }
                }

                if (statusCode) {
                    if (statusCode >= 300 && statusCode < 400 && headers.location) {
                        headers.location = `${req.protocol}://${req.headers.host}/proxy/` +
                            base64Encrypt(headers.location);
                    }

                    res.status(statusCode);
                }

                for (const [key, value] of Object.entries(headers)) {
                    res.set(key, value);
                }

                const encoded = headers["content-encoding"] && /(?:gzip|br)/.test(headers["content-encoding"]);
                const isHtml = headers["content-type"] && /text\/html/.test(headers["content-type"]);

                if (encoded && isHtml) {
                    res.removeHeader("content-length");

                    const decoder = ((encoding) => {
                        switch (encoding) {
                            case "br":
                                return zlib.createBrotliDecompress && zlib.createBrotliDecompress();
                            case "gzip":
                            default:
                                return zlib.createGunzip();
                        }
                    })(originRes.headers["content-encoding"]);

                    const encoder = ((encoding) => {
                        switch (encoding) {
                            case "br":
                                return zlib.createBrotliCompress && zlib.createBrotliCompress();
                            case "gzip":
                            default:
                                return zlib.createGzip();
                        }
                    })(originRes.headers["content-encoding"]);

                    if (decoder && encoder) {
                        pipe(originRes, decoder, new TransformHTML({
                            host: targetUrl.host || undefined,
                            path: targetUrl.path || undefined,
                            protocol: targetUrl.protocol || undefined,
                            proxyBaseURL: "/proxy/",
                        }), encoder, res, (err: Error) => {
                            if (err) {
                                return next(err);
                            }

                            if (deleteCacheTimeout) {
                                clearTimeout(deleteCacheTimeout);
                            }
                        });
                    } else {
                        pipe(originRes, res, (err: Error) => {
                            if (err) {
                                return next(err);
                            }

                            if (deleteCacheTimeout) {
                                clearTimeout(deleteCacheTimeout);
                            }
                        });
                    }
                } else if (isHtml) {
                    res.removeHeader("content-length");

                    pipe(originRes, new TransformHTML({
                        host: targetUrl.host || undefined,
                        path: targetUrl.path || undefined,
                        protocol: targetUrl.protocol || undefined,
                        proxyBaseURL: "/proxy/",
                    }), res, (err: Error) => {
                        if (err) {
                            return next(err);
                        }

                        if (deleteCacheTimeout) {
                            clearTimeout(deleteCacheTimeout);
                        }
                    });
                } else {
                    pipe(originRes, res, (err: Error) => {
                        if (err) {
                            return next(err);
                        }

                        if (deleteCacheTimeout) {
                            clearTimeout(deleteCacheTimeout);
                        }
                    });
                }
            } catch (err) {
                if (!aborted) {
                    next(err);
                }
            }
        };
    }
}
