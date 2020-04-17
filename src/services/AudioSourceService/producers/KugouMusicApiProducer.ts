import IOptions from "../IMethodOptions";

import Artist from "../Artist";
import Instance from "../Instance";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import KugouMusicApi from "../../../libraries/audioSource/KugouMusicApi";

import { getConfig, retry } from "../utils";

const config = getConfig();

export default class KugouMusicApiProducer extends Producer {
    public static readonly sources = [Source.kugou];
    public static readonly instances = config.producers.kugouMusicApi.instances
        .map((i) => new Instance(i.host, i.port, i.protocol));

    private readonly kugouMusicApi: KugouMusicApi;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();
        this.kugouMusicApi = new KugouMusicApi(host, port, protocol);
    }

    public async search(keywords: string, source: Source, { limit, playbackQuality = 0 }: IOptions = {}) {
        const kugouMusicApi = this.kugouMusicApi;
        const proxyPool = this.proxyPool;

        let err;
        let i = 0;

         while (i++ < (proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1)) {
            try {
                const tracks = (await (async () => {
                    try {
                        return await kugouMusicApi.search(keywords, {
                            proxy: proxyPool.getRandomProxy("CN") || undefined,
                        });
                    } catch (e) {
                        throw e;
                    }
                })()) || [];

                return new class extends TrackList<any> { // tslint:disable-line
                    public async get(index: number) {
                        const track = this.tracks[index];

                        if (!track) {
                            return null;
                        }

                        const details = await (async () => {
                            try {
                                return await kugouMusicApi.getSongUrl(track.FileHash, { proxy: proxyPool.getRandomProxy("CN") || undefined });
                            } catch (e) {
                                // console.log(e);

                                return null;
                            }
                        })();

                        const picture = (details && details.img) || undefined;
                        const streamUrl = (details && details.play_url) || undefined;

                        return new Track(track.FileHash, track.SongName, track.SingerName.split(/(?:、|,)/)
                            .map((singerName: string) => new Artist(singerName.trim())), source, {
                                duration: +track.SQDuration * 1000,
                                picture,
                                playbackSources: streamUrl && [new PlaybackSource([streamUrl], { quality: 0 })],
                            });
                    }
                }(tracks);
            } catch (e) {
                err = e;
            }
        }

        throw err;
    }

    public async getPlaybackSources(id: string, source: Source, { playbackQuality = 0 } = {}) {
        let i = 0;

        while (i++ < (this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1)) {
            try {
                const url = (await this.kugouMusicApi.getSongUrl(id, {
                    proxy: this.proxyPool.getRandomProxy("CN") || undefined,
                })).play_url;

                return url ? [new PlaybackSource([url], { quality: 0 })] : [];
            } catch { /**/ }
        }

        return [];
    }

    public async getAlternativeTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IOptions = {}) {
        return await (await source.search([
            track.name,
            ...track.artists.map((a) => a.name),
        ].join(","), { playbackQuality, limit })).values();
    }

    public async getTrack(id: string, source: Source, { playbackQuality = 0 } = {}) {
        const track = await retry(async () => {
            try {
                return await this.kugouMusicApi.getSongUrl(id, {
                    proxy: this.proxyPool.getRandomProxy("CN") || undefined,
                });
            } catch (e) {
                // console.log(e);

                throw e;
            }
        }, this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);

        if (!track) {
            return null;
        }

        if (track.hash !== id) {
            throw new Error(`Error getting track: id not match (${track.hash} is not matched to ${id}).`);
        }

        return new Track(id, track.song_name, track.authors.map((a: any) => new Artist(a.author_name)), source, {
            duration: track.timelength,
            picture: track.img,
            playbackSources: track.play_url ? [new PlaybackSource([track.play_url], {   quality: 0 })] : undefined,
        });
    }
}
