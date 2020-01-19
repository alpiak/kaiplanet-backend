import { request } from "../utils";

interface IOptions {
    rows?: number;
    pageSize?: number;
    pageNo?: number;
    proxy?: string;
    abortSignal?: AbortSignal;
}

export default class {
    private readonly host: string;
    private readonly port: number;
    private readonly protocol: string;

    constructor(host: string, port: number, protocol = "https") {
        this.host = host;

        if (typeof port === "undefined") {
            this.port = protocol === "https" ? 443 : 80;
        } else {
            this.port = port;
        }

        this.protocol = protocol;
    }

    public autocomplete(keyword: string, { proxy, abortSignal }: { proxy?: string, abortSignal?: AbortSignal } = {}) {
        return this.request("/autocomplete_tag", { keyword }, ["key", 0], { proxy, abortSignal });
    }

    public scrSearch(keyword: string, { rows, proxy, abortSignal }: IOptions = {}) {
        return this.request("/scr_search_tag", { keyword, rows, type: 2 }, ["musics"], { proxy, abortSignal });
    }

    public getCmsList(nid: string, { pageSize, pageNo, proxy, abortSignal }: IOptions = {}) {
        return this.request("/cms_list_tag", { nid, pageSize, pageNo }, ["result", "results"], { proxy, abortSignal });
    }

    private async request(path: string, data: any, dataPath: Array<string|number> = [], { abortSignal }: IOptions) {
        const res: any = await request({
            abortSignal,
            data,
            hostname: this.host,
            method: "GET",
            path,
            port: this.port,
            protocol: this.protocol,
        });

        // Responded with success.
        if (+res.code === 10000 || !res.code || res.code !== -100 || !res.msg || res.success) {
            let outputData = res;

            if (dataPath.length) {
                for (const currentPath of dataPath) {
                    if (currentPath && outputData[currentPath]) {
                        outputData = outputData[currentPath];
                    }
                }
            }

            return outputData || [];
        }

        throw new Error(res.msg);
    }
}
