module.exports = ({ Area }) => class Producer {
    static get Instance() {
        return class {
            get host() {
                return this._host;
            }

            get port() {
                return this._port;
            }

            get protocol() {
                return this._protocol;
            }

            get path() {
                return this._path;
            }

            get areas() {
                return this._areas;
            }

            _host;
            _port;
            _protocol;
            _path;

            constructor(host, port, protocol = "https", path) {
                this._host = host;

                if (typeof port === "undefined") {
                    this._port = protocol === "https" ? 443 : 80;
                } else {
                    this._port = port;
                }

                this._protocol = protocol;
                this._path = path;
            }
        };
    }

    static areas = new Set([Area.GLOBAL]);

    static getInstances() {
        return null;
    }

    _host;
    _port;
    _protocol;
    _path;

    constructor(host, port, protocol = "https", path) {
        this._host = host;

        if (typeof port === "undefined") {
            this._port = protocol === "https" ? 443 : 80;
        } else {
            this._port = port;
        }

        this._protocol = protocol;
        this._path = path;
    }

    fetchProxyList() {
        return null;
    }
};
