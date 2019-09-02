const KugouMusicApi = require("../../../libraries/audioSource/KugouMusicApi")();

module.exports = ({ Artist, Track, TrackList, List, Source, Producer, config }) => class KugouMusicApiProducer extends Producer {
    static get sources() {
        return KugouMusicApiProducer._sources;
    }

    static get instances() {
        return KugouMusicApiProducer._instances;
    }

    static _sources = [Source.kugou];
    static _instances = config.producers.kugouMusicApi.instances.map((instance) => new Producer.Instance(instance.host, instance.port, instance.protocol));

    _kugouMusicApi;

    constructor(host, port, protocol) {
        super(host, port, protocol);
        this._kugouMusicApi = new KugouMusicApi(host, port, protocol);
    }

    async search(keywords, source, { limit } = {}) {
        const kugouMusicApi = this._kugouMusicApi;

        const tracks = (await (async () => {
            try {
                return await kugouMusicApi.search(keywords, { limit });
            } catch (e) {
                throw e;
            }
        })()) || [];

        return new class extends TrackList {
            async get(index) {
                const track = this._tracks[index];

                if (!track) {
                    return null;
                }

                const details = await (async () => {
                    try {
                        return await kugouMusicApi.getSongUrl(track.FileHash);
                    } catch (e) {
                        return null;
                    }
                })();

                const picture = (details && details.img) || null;
                const url = details && details.play_url;

                return new Track(track.FileHash, track.SongName, +track.SQDuration * 1000, track.SingerName.split(/(?:、|,)/).map((singerName) => new Artist(singerName.trim())), picture, source, url);
            }
        }(tracks, source);
    }

    async getStreamUrls(id, source) {
        try {
            return [(await this._kugouMusicApi.getSongUrl(id)).play_url];
        } catch (e) {
            return [];
        }
    }

    async getAlternativeTracks(track, source, { limit } = {}) {
        return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { limit })).values();
    }
};
