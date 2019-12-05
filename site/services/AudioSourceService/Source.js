module.exports = ({ TrackList, config }) => class Source {
    static get kaiPlanet() {
        return this._kaiPlanet;
    }

    static get netEase() {
        return Source._netEase;
    }

    static get qq() {
        return Source._qq;
    }

    static get soundCloud() {
        return Source._soundCloud;
    }

    static get naver() {
        return Source._naver;
    }

    static get qianQian() {
        return Source._qianQian;
    }

    static get kugou() {
        return Source._kugou;
    }

    static get kuwo() {
        return Source._kuwo;
    }

    static get migu() {
        return Source._migu;
    }

    static get hearthis() {
        return Source._hearthis;
    }

    static _assetBaseUrl = config.assetBaseUrl;

    static _kaiPlanet = new Source("kaiplanet", "kaiplanet.net", {
        icons: [
            `/proxy//${Source._assetBaseUrl}/favicon.ico`,
            `${Source._assetBaseUrl}/favicon.ico`,
        ],
    });

    static _netEase = new Source("netease", "网易云音乐", {
        icons: [
            "/proxy/https://s1.music.126.net/style/favicon.ico",
            `${Source._assetBaseUrl}/netease.ico`,
            "https://s1.music.126.net/style/favicon.ico",
        ],
    });

    static _qq = new Source("qq", "QQ音乐", {
        icons: [
            "/proxy/https://y.qq.com/favicon.ico",
            `${Source._assetBaseUrl}/qq.ico`,
            "https://y.qq.com/favicon.ico",
        ],
    });

    static _soundCloud = new Source("soundcloud", "SoundCloud", {
        icons: [
            "/proxy/https://soundcloud.com/favicon.ico",
            `${Source._assetBaseUrl}/soundcloud.ico`,
            "https://soundcloud.com/favicon.ico",
        ],
    });

    static _naver = new Source("naver", "네이버 뮤직", {
        icons: [
            "/proxy/https://www.naver.com/favicon.ico",
            `${Source._assetBaseUrl}/naver.ico`,
            "https://www.naver.com/favicon.ico",
        ],
    });

    static _qianQian = new Source("qianqian", "千千音乐", {
        icons: [
            "/proxy/https://music.taihe.com/favicon.ico",
            `${Source._assetBaseUrl}/qianqian.ico`,
            "https://music.taihe.com/favicon.ico",
        ],
    });

    static _kugou = new Source("kugou", "酷狗音乐", {
        icons: [
            "/proxy/https://www.kugou.com/yy/static/images/play/logo.png",
            `${Source._assetBaseUrl}/kugou.ico`,
            "https://www.kugou.com/yy/static/images/play/logo.png",
            "/proxy/https://www.kugou.com/favicon.ico",
            "https://www.kugou.com/favicon.ico",
        ],
    });

    static _kuwo = new Source("kuwo", "酷我音乐", {
        icons: [
            "/proxy/https://kuwo.cn/favicon.ico",
            `${Source._assetBaseUrl}/kuwo.ico`,
            "https://kuwo.cn/favicon.ico",
        ],
    });

    static _migu = new Source("migu", "咪咕", {
        icons: [
            "/proxy/https://www.migu.cn/favicon.ico",
            `${Source._assetBaseUrl}/migu.ico`,
            "https://www.migu.cn/favicon.ico",
        ],
    });

    static _hearthis =  new Source("hearthis", "hearthis.at", {
        icons: [
            "/proxy/https://hearthis.at/favicon.ico",
            `${Source._assetBaseUrl}/hearthis.ico`,
            "https://hearthis.at/favicon.ico",
        ],
    });

    static fromId(id) {
        if (id === undefined || id === null) {
            return null;
        }

        for (const key in Source) {
            if (!Source.hasOwnProperty(key)) {
                continue;
            }

            const source = Source[key];

            if (source instanceof Source && source.id === id) {
                return source;
            }
        }

        return null;
    }

    static values() {
        const values = [];

        for (const key in Source) {
            if (!Source.hasOwnProperty(key)) {
                continue;
            }

            const source = Source[key];

            if (source instanceof Source) {
                values.push(source);
            }
        }

        return values;
    }

    get id() {
        return this._id;
    }

    get name() {
        return this._name;
    }

    get producers() {
        return this._producers;
    };

    get icons() {
        return this._icons;
    }

    _id;
    _name;
    _producers = [];
    _icons = [];

    constructor(id, name, { icons } = {}) {
        this._id = id;
        this._name = name;

        if (icons) {
            this._icons = icons;
        }
    }

    async getTrack(id, { playbackQuality = 0, producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const track = await producer.getTrack(id, this, { playbackQuality });

                if (track) {
                    return track;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    async search(keywords, { limit, producerRating, playbackQuality = 0 } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const tracks = await producer.search(keywords, this, { limit, playbackQuality });

                if (tracks && tracks.length) {
                    return tracks;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return new TrackList();
    }

    async getPlaybackSources(id, { producerRating, playbackQuality = 0 } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        const playbackSources = (await Promise.all(sortedProducers.map((producer) => producer.getPlaybackSources(id, this._id, { playbackQuality }))))
            .flat()
            .filter((playbackSource) => playbackSource);

        if (typeof producerRating !== "object" || !producerRating) {
            playbackSources.sort((a, b) => b.urls.join("").length - a.urls.join("").length);
        }

        // TODO: remove duplicated entries.

        return playbackSources;
    }

    async getLists({ limit, offset, producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const lists = await producer.getLists(this);

                if (lists && lists.length) {
                    return lists;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    async getList(listId, { playbackQuality = 0, limit, offset, producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const list = await producer.getList(listId, this, { playbackQuality, limit, offset });

                if (list) {
                    return list;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    async getRecommend(track, { playbackQuality = 0, producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        if (track) {
            let err;

            for (const producer of sortedProducers) {
                try {
                    const recommendedTrack = await producer.getRecommend(track, this, { playbackQuality });

                    if (recommendedTrack) {
                        return recommendedTrack;
                    }
                } catch (e) {
                    err = e;
                }
            }

            if (err) {
                throw err;
            }

            return null;
        }

        let err;

        for (const producer of sortedProducers) {
            try {
                const recommendedTrack = await producer.getRecommend(track, this, { playbackQuality });

                if (recommendedTrack) {
                    return recommendedTrack;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    async getAlternativeTracks(track, { playbackQuality = 0, limit, producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const tracks = await producer.getAlternativeTracks(track, this, { playbackQuality, limit });

                return tracks || null;
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    getProducers() {
        return this.producers;
    }

    getSortedProducers(producerRating) {
        if (typeof producerRating !== "object" || !producerRating) {
            return this.producers;
        }

        return [...this.producers].sort((a, b) => {
            const rankA = producerRating[a.id];
            const rankB = producerRating[b.id];

            if (typeof rankA !== "number" || typeof rankB !== "number") {
                return 0;
            }

            return rankA - rankB;

        });
    }
};
