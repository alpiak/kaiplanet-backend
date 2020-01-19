import { request } from "../utils";

interface IOptions {
    page?: number;
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

    public getRankList({ proxy, abortSignal }: { proxy?: string, abortSignal?: AbortSignal } = {}) {
        return this.request("/rank/list", { json: "true" }, ["rank", "list"], { proxy, abortSignal });
    }

    public getRankInfo(rankId: string, { page, proxy, abortSignal }: IOptions = {}) {
        return this.request("/rank/info/", {
            json: "true",
            page,
            rankid: rankId,
        }, ["songs", "list"], { proxy, abortSignal });
    }

    private async request(path: string, data: any, dataPath: string[] = [], { proxy, abortSignal }: IOptions = {}) {
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

        if (res && res[dataPath[0]]) {
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

        throw new Error(JSON.stringify(res));
    }
}
