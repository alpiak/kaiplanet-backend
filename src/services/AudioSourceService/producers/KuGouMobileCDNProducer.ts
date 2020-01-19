import IMethodOptions from "../IMethodOptions";

import Artist from "../Artist";
import Instance from "../Instance";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import KuGouMobileCDN from "../../../libraries/audioSource/KuGouMobileCDN";

import { getConfig, retry } from "../utils";

const config = getConfig();

export default class KuGouMobileCDNProducer extends Producer {
    public static readonly sources = [Source.kugou];

    public static readonly instances = config.producers.kuGouMobileCDN.instances
        .map((i: any) => new Instance(i.host, i.port, i.protocol));

    private readonly kuGouMobileCDN: KuGouMobileCDN;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();
        this.kuGouMobileCDN = new KuGouMobileCDN(host, port, protocol);
    }

    public async search(keywords: string, source: Source, { limit, playbackQuality = 0 }: IMethodOptions = {}) {
        const proxyPool = this.proxyPool;

        const tracks = (await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return await this.kuGouMobileCDN.searchSong(keywords, {
                            pagesize: limit,
                            proxy: proxyPool.getRandomProxy("CN") || undefined,
                        });
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return await this.kuGouMobileCDN.searchSong(keywords, { pagesize: limit });
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })()) || [];

        return new class extends TrackList<any> { // tslint:disable-line
            public async get(index: number) {
                const track = this.tracks[index];

                if (!track) {
                    return null;
                }

                return new Track(track.hash, track.songname, track.singername.split(/(?:、|,)/)
                    .map((singerName: string) => new Artist(singerName.trim())), source, {
                        duration: +track.duration * 1000,
                    });
            }
        }(tracks);
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IMethodOptions = {}) {
        return (await this.search([
            track.name,
            ...track.artists.map((a) => a.name),
        ].join(","), source, { playbackQuality, limit })).values();
    }
}
