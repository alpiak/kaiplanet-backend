module.exports = ({ Area }) => class Proxy {
    static HISTORY_RECORDS_LIMIT = 32;

    get host() {
        return this._host;
    }

    get protocol() {
        return this._protocol;
    }

    get port() {
        return this._port;
    }

    get area() {
        return this._area;
    }

    get historyResponseTime() {
        return this._historyResponseTime;
    }

    get historySpeed() {
        return this._historySpeed;
    }

    failureTimes = 0;

    _host;
    _protocol;
    _port;
    _area;
    _historyResponseTime = [];
    _historySpeed = [];

    constructor(host, protocol, port, area = Area.GLOBAL) {
        this._host = host;
        this._protocol = protocol;
        this._port = port;
        this._area = area;
    }

    recordResponseTime(responseTime) {
        if (this._historyResponseTime.length >= Proxy.HISTORY_RECORDS_LIMIT) {
            this._historyResponseTime.shift();
        }

        this._historyResponseTime.push(responseTime);
    }

    recordSpeed(speed) {
        if (this._historySpeed.length >= Proxy.HISTORY_RECORDS_LIMIT) {
            this._historySpeed.shift();
        }

        this._historySpeed.push(speed);
    }

    equals(proxy) {
        return this._host === proxy.host
            && this._protocol === proxy.protocol
            && this._port === proxy.port
            && this._area === proxy.area;
    }
};
