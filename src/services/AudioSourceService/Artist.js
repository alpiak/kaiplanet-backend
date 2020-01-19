module.exports = () => class {
    get name() {
        return this._name;
    }

    _name;

    constructor(name) {
        this._name = name;
    }
};
