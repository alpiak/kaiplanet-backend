module.exports = () => class {
    get status() {
        return this._status;
    }

    get responseTime() {
        return this._resopnseTime;
    }

    get speed() {
        return this._speed;
    }

    _status;
    _resopnseTime;
    _speed;

    constructor(status, responseTime, speed) {
        this._status = status;
        this._resopnseTime = responseTime;
        this._speed = speed;
    }
};
