const { request } = require('../utils');

module.exports =  () => class {
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

    searchSongs(keywords, { limit, offset, proxy, abortSignal } = {}) {
        return this.request("/search", { keywords, limit, offset }, ["result", "songs"], { proxy, abortSignal });
    }

    getSongDetail(ids, { proxy, abortSignal } = {}) {
        return this.request("/song/detail", {ids: ids.join(",") }, ["songs"], { proxy, abortSignal });
    }

    getSongURL(id, { proxy, abortSignal } = {}) {
        return this.request("/song/url", { id, br: 128000 }, ["data"], { proxy, abortSignal });
    }

    getToplist({ proxy, abortSignal } = {}) {
        return this.request("/toplist", null, ["list"], { proxy, abortSignal });
    }

    searchPlaylist(keywords, { limit, offset, proxy, abortSignal } = {}) {
        return this.request("/search", { keywords, type: 1000, limit, offset }, ["result", "playlists"], { proxy, abortSignal });
    }

    getPlaylistDetail(id, { proxy, abortSignal } = {}) {
        return this.request("/playlist/detail", { id }, ["playlist", "tracks"], { proxy, abortSignal });
    }

    getSimiSong(id, { proxy, abortSignal } = {}) {
        return this.request("/simi/song", { id }, ["songs"], { proxy, abortSignal });
    }

    async request(path, data, dataPath = [], { proxy, abortSignal } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: path,
            method: "GET",
            data: data,
            queries: { proxy },
            abortSignal,
        });

        if (res.code === 200) {
            let data = res;

            if (dataPath.length) {
                for (let i = 0; i < dataPath.length; i++) {
                    if (dataPath[i] && data[dataPath[i]]) {
                        data = data[dataPath[i]];
                    }
                }
            }

            return data || [];
        }

        throw new Error(res.msg);
    }
};
