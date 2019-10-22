module.exports = ({ Track }) => class {
    get id() {
        return this._id;
    }

    get name() {
        return this._name;
    }

    get source() {
        return this._source;
    }

    _id;
    _name;
    _source;

    constructor(id, name, source) {
        this._id = id;
        this._name = name;
        this._source = source;
    }

    async getList() {
        return [new Track(0, "", "", "", this._source)];
    }
};
