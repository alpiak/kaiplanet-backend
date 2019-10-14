const Hearthis = require("../../../libraries/audioSource/Hearthis")();

module.exports = ({ Artist, Track, TrackList, List, Source, Producer, config }) => {
    class HearthisTrackList extends TrackList {
        _source;
        _playbackQuality;

        constructor(tracks, source, { playbackQuality = 0 } = {}) {
            super(tracks);

            this._source = source;
            this._playbackQuality = playbackQuality;
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

        async search(keywords, source, { limit, playbackQuality = 0 } = {}) {
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

            return new HearthisTrackList(tracks, source, { playbackQuality });
        }

        async getPlaybackSources(id, source, { playbackQuality = 0 } = {}) {
            try {
                const url = (await this._hearthis.getTrack(id)).stream_url;

                return typeof url === "string" ? [new Track.PlaybackSource([url.replace(/^https/, "http")], 0)] : [];
            } catch (e) {
                return [];
            }
        }

        getLists(source) {
            return HearthisProducer._lists.get(source).map(({ id, name }) => new List(id, name, source));
        }

        async getList(id, source, { playbackQuality, limit, offset } = {}) {
            const tracks = await (async () => {
                try {
                    return (await this._hearthis.getFeed(id)) || null;
                } catch (e) {
                    throw e;
                }
            })();

            if (tracks) {
                return new HearthisTrackList(tracks, source, { playbackQuality }).values();
            }

            return null;
        }

        async getAlternativeTracks(track, source, { playbackQuality = 0, limit } = {}) {
            return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { playbackQuality, limit })).values();
        }

        async getTrack(id, source, { playbackQuality = 0 } = {}) {
            const track = await (async () => {
                try {
                    return await this._hearthis.getTrack(id);
                } catch (e) {
                    console.log(e);

                    throw e;
                }
            })();

            if (track) {
                return new Track(String(track.id), track.title, +track.duration * 1000, [new Artist(track.user.username)], track.artwork_url, source, typeof track.stream_url === "string" ? [new Track.PlaybackSource([track.stream_url.replace(/^https/, "http")], 0)] : undefined);
            }

            return null;
        }
    }
};
