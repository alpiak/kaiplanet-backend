module.exports = () => class Source {
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

    static _kaiPlanet = new Source("kaiplanet", "kaiplanet.net");
    static _netEase = new Source("netease", "网易云音乐");
    static _qq = new Source("qq", "QQ音乐");
    static _soundCloud = new Source("soundcloud", "SoundCloud");
    static _qianQian = new Source("qianqian", "千千音乐");
    static _kugou = new Source("kugou", "酷狗音乐");
    static _kuwo = new Source("kuwo", "酷我音乐");
    static _migu = new Source("migu", "咪咕");
    static _hearthis =  new Source("hearthis", "hearthis.at");

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

    _id;
    _name;
    _producers = [];

    constructor(id, name) {
        this._id = id;
        this._name = name;
    }

    async getTrack(id, { producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const track = await producer.getTrack(id, this);

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

    async search(keywords, { limit, producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const tracks = await producer.search(keywords, this, { limit });

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

        return null;
    }

    async getStreamUrls(id, { producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;
        const urls = (await Promise.all(sortedProducers.map((producer) => producer.getStreamUrls(id, this._id))))
            .flat()
            .filter((url) => url);

        if (typeof sourceRating !== "object" || !sourceRating) {
            urls.sort((a, b) => b.length - a.length);
        }

        return [...new Set(urls)];
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

    async getList(listId, { limit, offset, producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const list = await producer.getList(listId, this, { limit, offset });

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

    async getRecommend(track, { producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        if (track) {
            let err;

            for (const producer of sortedProducers) {
                try {
                    return (await producer.getRecommend(track, this)) || null;
                } catch (e) {
                    err = e;
                }
            }

            if (err) {
                throw err;
            }

            return null;
        }

        return null;
    }

    async getAlternativeTracks(track, { limit, producerRating } = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const tracks = await producer.getAlternativeTracks(track, this, { limit });

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
