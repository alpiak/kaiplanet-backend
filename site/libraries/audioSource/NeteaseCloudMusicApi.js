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

    searchSongs(keywords, { limit, offset }) {
        return this.request("/search", { keywords, limit, offset }, ["result", "songs"]);
    }

    getSongDetail(ids) {
        return this.request("/song/detail", {ids: ids.join(",") }, ["songs"]);
    }

    getSongURL(id) {
        return this.request("/song/url", { id }, ["data"]);
    }

    getToplist() {
        return this.request("/toplist", null, ["list"]);
    }

    searchPlaylist(keywords, { limit, offset }) {
        return this.request("/search", { keywords, type: 1000, limit, offset }, ["result", "playlists"]);
    }

    getPlaylistDetail(id) {
        return this.request("/playlist/detail", { id }, ["playlist", "tracks"]);
    }

    getSimiSong(id) {
        return this.request("/simi/song", { id }, ["songs"]);
    }

    async request(path, data, dataPath = []) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: path,
            method: "GET",
            data: data
        });

        if (res.code === 200) {
            if (dataPath.length) {
                let data = res;

                for (let i = 0; i < dataPath.length; i++) {
                    if (dataPath[i] && data[dataPath[i]]) {
                        data = data[dataPath[i]];
                    }
                }

                return data || [];
            }
        }

        throw new Error(res.msg);
    }
};
