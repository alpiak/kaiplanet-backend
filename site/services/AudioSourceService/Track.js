module.exports = () => class {
    get id() {
        return this._id;
    }

    get name() {
        return this._name;
    }

    get duration() {
        return this._duration;
    }

    get artists() {
        return this._artists;
    }

    get picture() {
        return this._picture;
    }

    get source() {
        return this._source;
    }

    get streamUrl() {
        return this._streamUrl;
    }

    _id;
    _name;
    _duration;
    _artists;
    _picture;
    _source;
    _streamUrl;

    constructor(id, name, duration, artists, picture, source, streamUrl) {
        this._id = id;
        this._name = name;
        this._duration = duration;
        this._artists = artists;
        this._picture = picture;
        this._source = source;
        this._streamUrl = streamUrl;
    }
};
