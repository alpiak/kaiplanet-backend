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

    autocomplete(keyword, { proxy, abortSignal } = {}) {
        return this.request("/autocomplete_tag", { keyword }, ["key", 0], { proxy, abortSignal });
    }

    scrSearch(keyword, { rows, proxy, abortSignal } = {}) {
        return this.request("/scr_search_tag", { keyword, rows, type: 2 }, ["musics"], { proxy, abortSignal });
    }

    getCmsList(nid, { pageSize, pageNo, proxy, abortSignal } = {}) {
        return this.request("/cms_list_tag", { nid, pageSize, pageNo }, ["result", "results"], { proxy, abortSignal });
    }

    async request(path, data, dataPath = [], { proxy, abortSignal } = {}) {
        const res = await request({
            protocol: this._protocol,
            hostname: this._host,
            port: this._port,
            path: path,
            method: "GET",
            data,
            abortSignal,
        });

        // Responded with success.
        if (+res.code === 10000 || !res.code || res.code !== -100 || !res.msg || res.success) {
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
