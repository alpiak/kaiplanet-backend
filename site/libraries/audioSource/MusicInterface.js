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

    async search(key, pageNum, pageSize) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            path: `${MusicInterface.basePath}/search/${encodeURIComponent(key)}${pageNum ? "/" + pageNum : ""}${pageNum && pageSize ? "/" + pageSize : ""}`,
            method: "GET"
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    async getSongUrllist(ids) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            path: `${MusicInterface.basePath}/songUrllist/${ids.join(",")}`,
            method: "GET"
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    async getToplists() {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            path: `${MusicInterface.basePath}/toplist`,
            method: "GET"
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }

    async getSongList(id) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            path: `${MusicInterface.basePath}/songList/${id}`,
            method: "GET"
        });

        if (res.errno === 0) {
            return (res.data && res.data.songList) || null;
        }

        throw new Error(res.msg);
    }

    async getAlbumImg(albummid, singerMid) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            path: `${MusicInterface.basePath}/albumImg/${albummid}/${singerMid}`,
            method: "GET"
        });

        if (res.errno === 0) {
            return res.data;
        }

        throw new Error(res.msg);
    }
};
