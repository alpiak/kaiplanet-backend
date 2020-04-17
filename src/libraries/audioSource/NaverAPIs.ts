import { request } from "../utils";

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

    public getTrackStPlay(id: string, { proxy, abortSignal }: IOptions = {}) {
        return this.request("/nmwebplayer/music/mobilewebmusic_stplay_trackStPlay", {
            "play.trackId": id,
        }, ["moduleInfo"], { proxy, abortSignal });
    }

    public getTracks(ids: string[], { proxy, abortSignal }: IOptions = {}) {
        return this.request("/musicpcplayer/musicapiweb/tracks/" + ids.join(","), undefined, ["response", "result", "tracks"], { proxy, abortSignal });
    }

    private async request(path: string, data: any, dataPath: string[] = [], { proxy, abortSignal }: IOptions = {}) {
        let outputData: any = await request({
            abortSignal,
            data,
            headers: { accept: "application/json" },
            hostname: this.host,
            method: "GET",
            path,
            port: this.port,
            protocol: this.protocol,
            proxy,
        });

        if (dataPath.length) {
            for (const currentPath of dataPath) {
                if (currentPath && outputData[currentPath]) {
                    outputData = outputData[currentPath];
                }
            }
        }

        return outputData || [];
    }
}
