const { retry } = require("../utils");

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

    async search(keywords, source, { limit, playbackQuality = 0 } = {}) {
        const kugouMusicApi = this._kugouMusicApi;
        const proxyPool = this._proxyPool;

        let err;
        let i = 0;

         while (i++ < (proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1)) {
            try {
                const tracks = (await (async () => {
                    try {
                        return await kugouMusicApi.search(keywords, {
                            limit,
                            proxy: proxyPool.getRandomProxy("CN"),
                        });
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
                                return await kugouMusicApi.getSongUrl(track.FileHash, { proxy: proxyPool.getRandomProxy("CN") });
                            } catch (e) {
                                console.log(e);

                                return null;
                            }
                        })();

                        const picture = (details && details.img) || undefined;
                        const streamUrl = (details && details.play_url) || undefined;

                        return new Track(track.FileHash, track.SongName, +track.SQDuration * 1000, track.SingerName.split(/(?:、|,)/).map((singerName) => new Artist(singerName.trim())), picture, source, streamUrl && [new Track.PlaybackSource([streamUrl], 0)]);
                    }
                }(tracks);
            } catch (e) {
                err = e;
            }
        }

        throw err;
    }

    async getPlaybackSources(id, source, { playbackQuality = 0 } = {}) {
        let i = 0;

        while (i++ < (this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1)) {
            try {
                const url = (await this._kugouMusicApi.getSongUrl(id, { proxy: this._proxyPool.getRandomProxy("CN") })).play_url;

                return url ? [new Track.PlaybackSource([url], 0)] : [];
            } catch { }
        }

        return [];
    }

    async getAlternativeTracks(track, source, { playbackQuality = 0, limit } = {}) {
        return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { playbackQuality, limit })).values();
    }

    async getTrack(id, source, { playbackQuality = 0 } = {}) {
        const track = await retry(async () => {
            try {
                return await this._kugouMusicApi.getSongUrl(id, { proxy: this._proxyPool.getRandomProxy("CN") });
            } catch (e) {
                console.log(e);

                throw e;
            }
        }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);

        if (track) {
            return new Track(track.hash, track.song_name, track.timelength, track.authors.map((author) => new Artist(author.author_name)), track.img, source, track.play_url ? [new Track.PlaybackSource([track.play_url], 0)] : undefined);
        }

        return null;
    }
};
