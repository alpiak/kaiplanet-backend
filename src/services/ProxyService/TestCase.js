const http = require("http");
const https = require("https");

module.exports = ({ Area }) => class TestCase {
    static FAILURE_TIMES_TO_MARK_AS_INVALID = 3;

    get url() {
        return this._url;
    }

    get method() {
        return this._method;
    }

    get areas() {
        return this._areas;
    }

    get originResponse() {
        return this._originResponse;
    }

    valid = true;

    _url;
    _method;
    _areas = new Set();
    _originResponse;
    _failureTimes = 0;

    constructor(url, method = "GET", areas = [Area.GLOBAL]) {
        this._url = url;
        this._method = method;

        if (Array.isArray(areas)) {
            this._areas = new Set(areas);
        } else {
            this._areas = new Set([areas]);
        }
    }

    async refreshOriginResponse() {
        this._originResponse = await new Promise((resolve, reject) => {
            try {
                const url = new URL(this.url);

                const client = (() => {
                    switch (url.protocol) {
                        case "http:":
                            return http;
                        case "https:":
                        default:
                            return https;
                    }
                })();

                const port = (() => {
                    if (url.port) {
                        return url.port;
                    }

                    switch (url.protocol) {
                        case "https:":
                            return 443;
                        case "http:":
                        default:
                            return 80;
                    }
                })();

                const req = client.request({
                    host: url.host,
                    port: port,
                    method: this.method,
                    path: url.pathname + url.search
                }, (res) => {
                    this._failureTimes = 0;
                    this.valid = true;

                    let data = Buffer.from("");

                    if (res.statusCode < 200 && res.statusCode >= 300) {
                        reject();

                        return;
                    }

                    res.on("data", chunk => {
                        data = Buffer.concat([data, chunk]);
                    });

                    res.on("end", () => {
                        resolve(data);
                    });

                }).on('error', (e) => {
                    this._failureTimes++;

                    if (this._failureTimes >= TestCase.FAILURE_TIMES_TO_MARK_AS_INVALID) {
                        this.valid = false;
                    }

                    reject(e);
                });

                req.end();
            } catch (e) {
                this._failureTimes++;

                if (this._failureTimes >= TestCase.FAILURE_TIMES_TO_MARK_AS_INVALID) {
                    this.valid = false;
                }

                reject(e);
            }
        });
    }
};
