import ProxyPool from "../../ProxyPool";
import BrowserService from "../BrowserService";

import IProducer from "./IProducer";
import IOptions from "./IProducerConstructOptions";
import IMethodOptions from "./IProducerMethodOptions";

import Area from "./Area";
import Instance from "./Instance";
import Proxy from "./Proxy";

import configDevelopment from "./config/development";
import configProduction from "./config/production";

export default abstract class implements IProducer {
    public static get instances(): Instance[]|null {
        return null;
    }

    public static areas = new Set([Area.GLOBAL]);

    protected static get config() {
        switch (process.env.NODE_ENV) {
            case "production":
                return configProduction;

            case "development":
            default:
                return configDevelopment;
        }
    }

    public proxyPool!: ProxyPool;
    public browserService!: BrowserService;
    protected host?: string;
    protected port?: number;
    protected protocol?: string;
    protected path?: string;
    protected userAgent?: string;

    protected constructor(host?: string, port?: number, protocol = "https", { path, userAgent }: IOptions = {}) {
        this.host = host;

        if (typeof port === "undefined") {
            this.port = protocol === "https" ? 443 : 80;
        } else {
            this.port = port;
        }

        this.protocol = protocol;
        this.path = path;
        this.userAgent = userAgent;
    }

    public abstract fetchProxyList(length: number, area: Area, options?: IMethodOptions): Promise<Proxy[]|null>|null;

    protected async executeInBrowser(callback: () => any, area = Area.GLOBAL, { abortSignal }: IMethodOptions) {
        const browserPage = await this.browserService.createBrowserPage({
            proxy: this.proxyPool.getRandomProxy(area.code),
        });

        if (abortSignal) {
            abortSignal.addEventListener("abort", () => {
                browserPage.close();
            });
        }

        try {
            await browserPage.setRequestInterception(true);

            browserPage.on("request", (request) => {
                if (request.resourceType() === "image") {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            if (this.userAgent) {
                await browserPage.setUserAgent(this.userAgent);
            }

            await browserPage.goto(`${this.protocol}${this.protocol && "://"}${this.host}${this.port && ":"}${this.host && this.port}${this.path}`);

            const data = await browserPage.evaluate(callback);

            browserPage.close();

            return data;
        } catch (e) {
            // console.log(e);

            browserPage.close();

            throw e;
        }
    }
}
