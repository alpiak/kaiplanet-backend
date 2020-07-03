import { fetchData } from "../utils";

interface IOptions {
    page?: number;
    pagesize?: number;
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

    public searchSong(keyword: string, { page, pagesize, proxy, abortSignal }: IOptions = {}) {
        return this.request("/api/v3/search/song", { keyword, page, pagesize, format: "json", showtype: "1" }, ["data", "info"], { proxy, abortSignal });
    }

    private async request(path: string, data: any, dataPath: string[] = [], { proxy, abortSignal }: IOptions = {}) {
        const res: any = await fetchData({
            abortSignal,
            data,
            hostname: this.host,
            method: "GET",
            path,
            port: this.port,
            protocol: this.protocol,
            proxy,
        });

        if (res.status === 1) {
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

        throw new Error(res.error);
    }
}
