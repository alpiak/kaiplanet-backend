const { request } = require('../utils');

module.exports =  () => class MusicInterface {
    static basePath = "/api/v2/music";

    _host;
    _port;
    _protocol;

    constructor(host, port, protocol = "https") {
        this._host = host;

        if (typeof port === "undefined") {
            this._port = protocol === "https" ? 443 : 80;
        } else {
            this._port = port;
        }

        this._protocol = protocol;
    }

    async search(key, pageNum, pageSize, { abortSignal } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: `${MusicInterface.basePath}/search/${encodeURIComponent(key)}${pageNum ? "/" + pageNum : ""}${pageNum && pageSize ? "/" + pageSize : ""}`,
            method: "GET",
            rejectUnauthorized: false,
            abortSignal,
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    async getSongUrllist(ids, { abortSignal } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: `${MusicInterface.basePath}/songUrllist/${ids.join(",")}`,
            method: "GET",
            rejectUnauthorized: false,
            abortSignal,
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    async getToplists({ abortSignal } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: `${MusicInterface.basePath}/toplist`,
            method: "GET",
            rejectUnauthorized: false,
            abortSignal,
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    async getSongList(id, { abortSignal } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: `${MusicInterface.basePath}/songList/${id}`,
            method: "GET",
            rejectUnauthorized: false,
            abortSignal,
        });

        if (res.errno === 0) {
            return (res.data && res.data.songList) || null;
        }

        throw new Error(res.msg);
    }

    async getAlbumImg(albummid, singerMid, { abortSignal } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: `${MusicInterface.basePath}/albumImg/${albummid}/${singerMid}`,
            method: "GET",
            rejectUnauthorized: false,
            abortSignal,
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }
};
