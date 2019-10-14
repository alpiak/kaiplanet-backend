module.exports = () => class {
    static PlaybackSource = class {
        get urls() {
            return this._urls;
        }

        get quality() {
            return this._quality;
        }

        _urls;
        _quality;

        constructor(urls, quality = 0) {
            if (Array.isArray(urls) && urls.filter((url) => url).length) {
                this._urls = urls.filter((url) => url);
            } else {
                this._urls = urls && [urls];
            }

            this._quality = quality;
        }

    };

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

    get playbackSources() {
        return this._playbackSources;
    }

    _id;
    _name;
    _duration;
    _artists;
    _picture;
    _source;
    _playbackSources;

    constructor(id, name, duration, artists, picture, source, playbackSources) {
        this._id = id;
        this._name = name;
        this._duration = duration;
        this._artists = artists;
        this._picture = picture;
        this._source = source;

        if (Array.isArray(playbackSources)) {
            this._playbackSources = playbackSources;
        } else {
            this._playbackSources = playbackSources && [playbackSources];
        }
    }
};
