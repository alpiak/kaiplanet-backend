/**
 * Created by qhyang on 2018/4/27.
 */

import * as url from "url";

import { Express, Request, Response } from "express";
import * as mime from "mime";

// @ts-ignore
import * as sendRanges from "send-ranges";

import IRange from "../services/ProxyService/IRange";
import ProxyPool from "../services/ProxyService/ProxyPool";

import ProxyMiddlewareFactory from "../middlewares/ProxyMiddlewareFactory";

interface IProxyControllerOptions {
    proxyPool: ProxyPool;
    proxyService: any;
    cacheService: any;
    locationService: any;
}

export default class {
    public readonly proxyPool: ProxyPool;
    public readonly proxyService: any;
    public readonly cacheService: any;
    public readonly locationService: any;

    constructor({ proxyPool, proxyService, cacheService, locationService }: IProxyControllerOptions) {
        this.proxyPool = proxyPool;
        this.proxyService = proxyService;
        this.cacheService = cacheService;
        this.locationService = locationService;
    }

    public registerProxyRoutes(app: Express) {
        const proxy = new ProxyMiddlewareFactory({
            cacheService: this.cacheService,
            locationService: this.locationService,
            proxyPool: this.proxyPool,
        }).createMiddleware();

        const retrieveStream = (req: Request) => {
            try {
                const urlStr = req.url.split("?")[0];
                const parseBase64 = (str: string) => Buffer.from(str, "base64").toString("ascii");
                const parsedUrlStr = parseBase64(urlStr.replace(/^\/+/, "").replace(/\/+$/, ""));

                let targetUrlStr;

                if (/\./.test(urlStr) || /:/.test(urlStr)) {
                    targetUrlStr = urlStr;
                } else if (/\./.test(parsedUrlStr) || /:/.test(parsedUrlStr)) {
                    targetUrlStr = parsedUrlStr;
                } else {
                    return false;
                }

                const fixedUrlStr = ((urlToFix) => {
                    if (!/:/.test(urlToFix)) {
                        return "https://" + urlToFix;
                    }

                    return urlToFix;
                })(targetUrlStr.replace(/^\/+/, "").replace(/\/+$/, ""));

                const targetUrl = url.parse(fixedUrlStr);

                if (!this.cacheService.exists(targetUrl.href)) {
                    return false;
                }

                const metadata = this.cacheService.getMetadata(targetUrl.href);
                const size = metadata.byteLength || (metadata.headers && metadata.headers["content-length"]);
                const type = (metadata.headers && metadata.headers["content-type"]) || mime.getType(targetUrl.href);
                const getStream = (range: IRange) => this.cacheService.get(targetUrl.href, range);

                return { getStream, size, metadata, type };
            } catch (err) {
                // console.log(err);

                return false;
            }
        };

        interface IMetadata {
            headers: object;
        }

        const beforeSend = ({ response, metadata }: { response: Response, metadata: IMetadata }, cb: () => void) => {
            for (const [key, value] of Object.entries(metadata.headers)) {
                if (key === "content-length" || key === "content-type") {
                    continue;
                }

                response.set(key, value);
            }

            cb();
        };

        app.use("/proxy", sendRanges(retrieveStream, { beforeSend }), proxy);

    }

    public registerRoutes(app: Express) {
        app.post("/proxy/list", (req, res) => this.getProxyList(req, res));
    }

    /**
     * @api {post} /proxy/list
     *
     * @apiParam {String="GLOBAL","CN"} area="GLOBAL" The physical location of the proxy
     * @apiParam {String="https","http","all"} protocol="all" Proxy protocol
     * @apiParam {String="responseTime","speed"} sortBy="responseTime" The attribute to sort the proxy list
     */
    private getProxyList({ body: { area, protocol, sortBy } }: Request, res: Response) {
        try {
            res.json({
                code: 1,
                data: this.proxyService.getProxyList(area || "GLOBAL", protocol || "all", sortBy || "responseTime"),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: "Query Failed - " + e.message,
            });
        }
    }
}
