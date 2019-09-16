const { request } = require("../utils");

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

    searchSong(keyword, { page, pagesize, proxy } = {}) {
        return this.request("/api/v3/search/song", { keyword, page, pagesize, format: "json", showtype: "1" }, ["data", "info"], { proxy });
    }

    async request(path, data, dataPath = [], { proxy } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: path,
            method: "GET",
            data,
            proxy,
        });

        if (res.status === 1) {
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

        throw new Error(res.message);
    }
};
