module.exports = ({ TrackList }) => class Producer {
    static get Instance() {
        return class {
            _host;
            _port;
            _protocol;

            get host() {
                return this._host;
            }

            get port() {
                return this._port;
            }

            get protocol() {
                return this._protocol;
            }

            constructor(host, port, protocol = "https") {
                this._host = host;

                if (typeof port === "undefined") {
                    this._port = protocol === "https" ? 443 : 80;
                } else {
                    this._port = port;
                }

                this._protocol = protocol;
            }
        };
    }

    static PROXY_RETRY_TIMES = 1;

    static _sources = [];

    static get sources() {
        return Producer._sources;
    }

    set proxyPool(proxyPool) {
        this._proxyPool = proxyPool;
    }

    _proxyPool = { getProxyList() { return null; } };

    constructor() { }

    async search(keywords, source, { limit, playbackQuality = 0, abortSignal } = {}) {
        return new TrackList();
    }

    async getPlaybackSources(id, source, { playbackQuality = 0, abortSignal } = {}) {
        return [];
    }

    async getRecommends(track, source, { playbackQuality = 0, abortSignal } = {}) {
        return null;
    }

    async getLists({ abortSignal } = {}) {
        return null;
    }

    async getList(id, source, { playbackQuality = 0, limit, offset, abortSignal } = {}) {
        return null;
    }

    async getAlternativeTracks(track, source, { playbackQuality = 0, limit, abortSignal } = {}) {
        return [];
    }

    async getTrack(id, source, { playbackQuality = 0, abortSignal } = {}) {
        return null;
    }
};
