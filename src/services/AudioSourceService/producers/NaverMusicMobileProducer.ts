import IOptions from "../IMethodOptions";
import IProducer from "../IProducer";

import Artist from "../Artist";
import Instance from "../Instance";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import NaverMusicMobile from "../../../libraries/audioSource/NaverMusicMobile";

import { getConfig, retry } from "../utils";

const config = getConfig();

export default class extends Producer implements IProducer {
    public static readonly sources = [Source.naver];

    public static readonly instances = config.producers.naverMusicMobile.instances
        .map(({ host, port, protocol }: any) => new Instance(host, port, protocol));

    private readonly naverMusicMobile: NaverMusicMobile;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();

        this.naverMusicMobile = new NaverMusicMobile(host, port, protocol, {
            userAgent: config.producers.naverMusicMobile.userAgent,
        });
    }

    public async search(keywords: string, source: Source, { offset, limit, playbackQuality = 0 }: IOptions = {}) {
        const proxyPool = this.proxyPool;

        const tracks = (await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return await this.naverMusicMobile.search(keywords, {
                            proxy: proxyPool.getRandomProxy("KR") || undefined,
                        });
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, proxyPool.getRandomProxy("KR") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return await this.naverMusicMobile.search(keywords);
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

                return new Track(track.id, track.name, track.artists.map((a: any) => new Artist(a.replace(/(?<=\S+)\s*\((?:\S|\s)+\)\s*/, ""), {
                    aliases: (() => {
                        const aliasResult = /\S+\s*\(((?:\S|\s)+?)\)/.exec(a);

                        return (aliasResult && aliasResult[1]) ? [aliasResult[1]] : undefined;
                    })(),
                })), source, {
                    picture: track.img || undefined,
                });
            }
        }(tracks);
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IOptions = {}) {
        return await (await this.search([
            track.name,

            ...track.artists.map((a) => a.name),
        ].join(","), source, { playbackQuality, limit })).values();
    }
}
