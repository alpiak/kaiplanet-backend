import { fetchData } from "../utils";

interface IOptions { abortSignal?: AbortSignal; }

export default class MusicInterface {
    private static readonly basePath = "/api/v2/music";

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

    public async search(key: string, pageNum?: number, pageSize?: number, { abortSignal }: IOptions = {}) {
        const res: any = await fetchData({
            abortSignal,
            hostname: this.host,
            method: "GET",
            path: `${MusicInterface.basePath}/search/${encodeURIComponent(key)}${pageNum ? "/" + pageNum : ""}${pageNum && pageSize ? "/" + pageSize : ""}`,
            port: this.port,
            protocol: this.protocol,
            rejectUnauthorized: false,
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    public async getSongUrllist(ids: string[], { abortSignal }: IOptions = {}) {
        const res: any = await fetchData({
            abortSignal,
            hostname: this.host,
            method: "GET",
            path: `${MusicInterface.basePath}/songUrllist/${ids.join(",")}`,
            port: this.port,
            protocol: this.protocol,
            rejectUnauthorized: false,
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    public async getToplists({ abortSignal }: IOptions = {}) {
        const res: any = await fetchData({
            abortSignal,
            hostname: this.host,
            method: "GET",
            path: `${MusicInterface.basePath}/toplist`,
            port: this.port,
            protocol: this.protocol,
            rejectUnauthorized: false,
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    public async getSongList(id: string, { abortSignal }: IOptions = {}) {
        const res: any = await fetchData({
            abortSignal,
            hostname: this.host,
            method: "GET",
            path: `${MusicInterface.basePath}/songList/${id}`,
            port: this.port,
            protocol: this.protocol,
            rejectUnauthorized: false,
        });

        if (res.errno === 0) {
            return (res.data && res.data.songList) || null;
        }

        throw new Error(res.msg);
    }

    public async getAlbumImg(albummid: string, singerMid: string, { abortSignal }: IOptions = {}) {
        const res: any = await fetchData({
            abortSignal,
            hostname: this.host,
            method: "GET",
            path: `${MusicInterface.basePath}/albumImg/${albummid}/${singerMid}`,
            port: this.port,
            protocol: this.protocol,
            rejectUnauthorized: false,
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }
}
