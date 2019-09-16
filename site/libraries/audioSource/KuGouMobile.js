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

    getRankList({ proxy } = {}) {
        return this.request("/rank/list", { json: "true" }, ["rank", "list"], { proxy });
    }

    getRankInfo(rankId, { page, proxy } = {}) {
        return this.request("/rank/info/", { rankid: rankId, page, json: "true" }, ["songs", "list"], { proxy });
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

        if (res && res[dataPath[0]]) {
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

        throw new Error(JSON.stringify(res));
    }
};
