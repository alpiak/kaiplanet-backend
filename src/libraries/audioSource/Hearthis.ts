import { request } from "../utils";

interface IOptions {
    count?: number;
    abortSignal?: AbortSignal;
    proxy?: string;
}

export default class {
    private readonly host: string;
    private readonly port: number;
    private readonly protocol: string;

    constructor(host: string, port: number, protocol: string = "https") {
        this.host = host;

        if (typeof port === "undefined") {
            this.port = protocol === "https" ? 443 : 80;
        } else {
            this.port = port;
        }

        this.protocol = protocol;
    }

    public search(t: string, { count, proxy, abortSignal }: IOptions = {}) {
        return this.request("/search/", {
            count,
            page: 1,
            t: t.replace(" ", "+"),
        }, { proxy, abortSignal });
    }

    public getTrack(id: string, { proxy, abortSignal }: IOptions = {}) {
        return this.request(`/${id}/`, undefined, { proxy, abortSignal });
    }

    /**
     * Get feed.
     * @param {string="popular","new"} type
     */
    public getFeed(type: string, { count = 20, proxy, abortSignal }: IOptions = {}) {
        return this.request("/feed/", { type, count }, { proxy, abortSignal });
    }

    private async request(path: string, data?: any, { proxy, abortSignal }: IOptions = {}) {
        const res: any = await request({
            abortSignal,
            data,
            hostname: this.host,
            method: "GET",
            path,
            port: this.port,
            protocol: this.protocol,
            proxy,
        });

        if (res.success === false) {
            throw new Error(res.message);
        }

        if (Array.isArray(res)) {
            return res;
        } else if (res.id) {
            return res;
        }

        throw new Error(res.message);
    }
}
