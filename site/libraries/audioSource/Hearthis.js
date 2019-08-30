const { request } = require('../utils');

module.exports =  () => class Hearthis {
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

    search(t, { limit }) {
        return this.request("/search/", {
            t: t.replace(' ', '+'),
            page: 1,
            count: limit,
        });
    }

    getTrack(id) {
        return this.request(`/${id}/`);
    }

    /**
     * Get feed.
     * @param {string="popular","new"} type
     */
    getFeed(type) {
        return this.request("/feed/", { type });
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

        if (res.success === false) {
            throw new Error(res.message);
        }

        if (Array.isArray(res)) {
            return res;
        } else if (res.id) {
            return res;
        }

        throw new Error(res.message);
    }
}
