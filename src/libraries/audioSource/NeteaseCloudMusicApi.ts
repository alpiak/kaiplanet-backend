import { request } from "../utils";

interface IOptions {
    limit?: number;
    offset?: number;
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

    public searchSongs(keywords: string, { limit, offset, proxy, abortSignal }: IOptions = {}) {
        return this.request("/search", { keywords, limit, offset }, ["result", "songs"], { proxy, abortSignal });
    }

    public getSongDetail(ids: string[], { proxy, abortSignal }: IOptions = {}) {
        return this.request("/song/detail", {ids: ids.join(",") }, ["songs"], { proxy, abortSignal });
    }

    public getSongURL(id: string, { proxy, abortSignal }: IOptions = {}) {
        return this.request("/song/url", { id, br: 128000 }, ["data"], { proxy, abortSignal });
    }

    public getToplist({ proxy, abortSignal }: IOptions = {}) {
        return this.request("/toplist", null, ["list"], { proxy, abortSignal });
    }

    public searchPlaylist(keywords: string, { limit, offset, proxy, abortSignal }: IOptions = {}) {
        return this.request("/search", {
            keywords,
            limit,
            offset,
            type: 1000,
        }, ["result", "playlists"], { proxy, abortSignal });
    }

    public getPlaylistDetail(id: string, { proxy, abortSignal }: IOptions = {}) {
        return this.request("/playlist/detail", { id }, ["playlist", "tracks"], { proxy, abortSignal });
    }

    public getSimiSong(id: string, { proxy, abortSignal }: IOptions = {}) {
        return this.request("/simi/song", { id }, ["songs"], { proxy, abortSignal });
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
            queries: { proxy },
        });

        if (res.code === 200) {
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
