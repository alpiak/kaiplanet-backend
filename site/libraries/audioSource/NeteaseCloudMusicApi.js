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

    searchSongs(keywords, { limit, offset, proxy } = {}) {
        return this.request("/search", { keywords, limit, offset }, ["result", "songs"], { proxy });
    }

    getSongDetail(ids, { proxy } = {}) {
        return this.request("/song/detail", {ids: ids.join(",") }, ["songs"], { proxy });
    }

    getSongURL(id, { proxy } = {}) {
        return this.request("/song/url", { id }, ["data"], { proxy });
    }

    getToplist({ proxy } = {}) {
        return this.request("/toplist", null, ["list"], { proxy });
    }

    searchPlaylist(keywords, { limit, offset, proxy } = {}) {
        return this.request("/search", { keywords, type: 1000, limit, offset }, ["result", "playlists"], { proxy });
    }

    getPlaylistDetail(id, { proxy } = {}) {
        return this.request("/playlist/detail", { id }, ["playlist", "tracks"], { proxy });
    }

    getSimiSong(id, { proxy } = {}) {
        return this.request("/simi/song", { id }, ["songs"], { proxy });
    }

    async request(path, data, dataPath = [], { proxy } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: path,
            method: "GET",
            data: data,
            queries: { proxy },
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
