const Hearthis = require("../../../libraries/audioSource/Hearthis")();

module.exports = ({ Artist, Track, TrackList, List, Source, Producer, config }) => {
    class HearthisTrackList extends TrackList {
        _source;

        constructor(tracks, source) {
            super(tracks);
            this._source = source;
        }

        async get(index) {
            const track = this._tracks[index];

            if (!track) {
                return null;
            }

            return new Track(String(track.id), track.title, +track.duration * 1000, [new Artist(track.user.username)], track.artwork_url, this._source);
        }
    }

    return class HearthisProducer extends Producer {
        static get sources() {
            return HearthisProducer._sources;
        }

        static get instances() {
            return HearthisProducer._instances;
        }

        static _sources = [Source.hearthis];
        static _instances = config.producers.hearthis.instances.map((instance) => new Producer.Instance(instance.host, instance.port, instance.protocol));

        static _lists = new Map([
            [Source.hearthis, [{ id: "popolar", name: "Popular" }]],
        ]);

        _hearthis;

        constructor(host, port, protocol) {
            super(host, port, protocol);
            this._hearthis = new Hearthis(host, port, protocol);
        }

        async search(keywords, source, { limit } = {}) {
            const tracks = (await (async () => {
                try {
                    return await this._hearthis.search(keywords, { limit });
                } catch (e) {
                    if (e.message === "limit reached") {
                        return null;
                    }

                    throw e;
                }
            })()) || [];

            return new HearthisTrackList(tracks, source);
        }

        async getStreamUrls(id, source) {
            try {
                const url = (await this._hearthis.getTrack(id)).stream_url;

                return typeof url === "string" ? url.replace(/^https/, "http") : null;
            } catch (e) {
                return [];
            }
        }

        getLists(source) {
            return HearthisProducer._lists.get(source).map(({ id, name }) => new List(id, name, source));
        }

        async getList(id, source, { limit, offset } = {}) {
            const tracks = await (async () => {
                try {
                    return (await this._hearthis.getFeed(id)) || null;
                } catch (e) {
                    throw e;
                }
            })();

            if (tracks) {
                return new HearthisTrackList(tracks, source).values();
            }

            return null;
        }

        async getAlternativeTracks(track, source, { limit } = {}) {
            return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { limit })).values();
        }

        async getTrack(id, source) {
            const track = await (async () => {
                try {
                    return await this._hearthis.getTrack(id);
                } catch (e) {
                    console.log(e);

                    throw e;
                }
            })();

            if (track) {
                return new Track(String(track.id), track.title, +track.duration * 1000, [new Artist(track.user.username)], track.artwork_url, source, typeof track.stream_url === "string" ? track.stream_url.replace(/^https/, "http") : null);
            }

            return null;
        }
    }
};
