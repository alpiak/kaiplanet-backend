const { retry } = require("../utils");

const KuGouMobileCDN = require("../../../libraries/audioSource/KuGouMobileCDN")();

module.exports = ({ Artist, Track, TrackList, Source, Producer, config }) => class KuGouMobileCDNProducer extends Producer {
    static get sources() {
        return KuGouMobileCDNProducer._sources;
    }

    static get instances() {
        return KuGouMobileCDNProducer._instances;
    }

    static _sources = [Source.kugou];
    static _instances = config.producers.kuGouMobileCDN.instances.map((instance) => new Producer.Instance(instance.host, instance.port, instance.protocol));

    _kuGouMobileCDN;

    constructor(host, port, protocol) {
        super(host, port, protocol);
        this._kuGouMobileCDN = new KuGouMobileCDN(host, port, protocol);
    }

    async search(keywords, source, { limit } = {}) {
        const proxyPool = this._proxyPool;

        const tracks = (await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return await this._kuGouMobileCDN.searchSong(keywords, {
                            pagesize: limit,
                            proxy: proxyPool.getRandomProxy("CN"),
                        });
                    } catch (e) {
                        console.log(e);

                        throw e;
                    }
                }, proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                console.log(e);

                try {
                    return await this._kuGouMobileCDN.searchSong(keywords, { pagesize: limit });
                } catch (e) {
                    console.log(e);

                    throw e;
                }
            }
        })()) || [];

        return new class extends TrackList {
            async get(index) {
                const track = this._tracks[index];

                if (!track) {
                    return null;
                }

                return new Track(track.hash, track.songname, +track.duration * 1000, track.singername.split(/(?:、|,)/).map((singerName) => new Artist(singerName.trim())), undefined, source);
            }
        }(tracks);
    }

    async getAlternativeTracks(track, source, { limit } = {}) {
        return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { limit })).values();
    }
};
