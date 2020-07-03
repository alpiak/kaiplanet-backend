import { fetchData } from "../utils";

interface IOptions {
    abortSignal?: AbortSignal;
    proxy?: string;
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

    public search(keywords: string, { proxy, abortSignal }: IOptions = {}) {
        return this.request("/search", { keywords, proxy }, ["data", "lists"], { abortSignal });
    }

    public getSongUrl(hash: string, { proxy, abortSignal }: IOptions = {}) {
        return this.request("/songurl", { hash, proxy }, ["data"], { abortSignal });
    }

    private async request(path: string, data: any, dataPath: string[] = [], { abortSignal }: IOptions = {}) {
        const res: any = await fetchData({
            abortSignal,
            data,
            hostname: this.host,
            method: "GET",
            path,
            port: this.port,
            protocol: this.protocol,
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

        throw new Error(res.message);
    }
}
