import IOptions from "../IMethodOptions";
import IProducer from "../IProducer";

import Artist from "../Artist";
import Instance from "../Instance";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";

import NaverAPIs from "../../../libraries/audioSource/NaverAPIs";

import { getConfig, retry } from "../utils";

const config = getConfig();

export default class NaverAPIsProducer extends Producer implements IProducer {
    public static readonly sources = [Source.naver];

    public static readonly instances = config.producers.naverAPIs.instances
        .map((i: any) => new Instance(i.host, i.port, i.protocol));

    private readonly naverAPIs: NaverAPIs;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();
        this.naverAPIs = new NaverAPIs(host, port, protocol);
    }

    public async getPlaybackSources(id: string, source: Source, { playbackQuality = 0, abortSignal }: IOptions = {}) {
        return await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return [new PlaybackSource([(await this.naverAPIs.getTrackStPlay(id, {
                            abortSignal,
                            proxy: this.proxyPool.getRandomProxy("KR") || undefined,
                        })).trackPlayUrl], { quality: 0 })];
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, this.proxyPool.getRandomProxy("KR") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return [new PlaybackSource([(await this.naverAPIs.getTrackStPlay(id, {
                        abortSignal,
                    })).trackPlayUrl], { quality: 0 })];
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })();
    }

    public async getTrack(id: string, source: Source, { playbackQuality = 0, abortSignal }: IOptions = {}) {
        const track = await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return (await this.naverAPIs.getTracks([id], {
                            abortSignal,
                            proxy: this.proxyPool.getRandomProxy("KR") || undefined,
                        }))[0];
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, this.proxyPool.getRandomProxy("KR") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return [new PlaybackSource([(await this.naverAPIs.getTracks([id], { abortSignal })).trackPlayUrl], {
                        quality: 0,
                    })];
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })();

        if (track) {
            const { trackId, trackTitle, artists } = track;
            return new Track(String(trackId), trackTitle, artists.map((a: any) => new Artist(a.artistName.replace(/(?<=\S+)\s*\((?:\S|\s)+\)\s*/, ""), {
                aliases: (() => {
                    const aliasResult = /\S+\s*\(((?:\S|\s)+?)\)/.exec(a.artistName);

                    return (aliasResult && aliasResult[1]) ? [aliasResult[1]] : undefined;
                })(),
            })), source, { picture: (track.album && track.album.imageUrl) || undefined });
        }

        return null;
    }
}
