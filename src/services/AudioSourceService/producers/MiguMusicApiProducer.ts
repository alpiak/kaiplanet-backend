import IOptions from "../IMethodOptions";

import MiguMusicApi from "../../../libraries/audioSource/MiguMusicApi";

import Artist from "../Artist";
import Instance from "../Instance";
import List from "../List";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import { getConfig, retry } from "../utils";

const config = getConfig();

export default class MiguMusicApiProducer extends Producer {
    public static readonly sources = [Source.migu];

    public static readonly instances = config.producers.miguMusicApi.instances
        .map((i) => new Instance(i.host, i.port, i.protocol));

    private readonly miguMusicApi: MiguMusicApi;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();
        this.miguMusicApi = new MiguMusicApi(host, port, protocol);
    }

    public async search(keywords: string, source: Source, { playbackQuality = 0, limit }: IOptions = {}) {
        const proxyPool = this.proxyPool;

        const tracks = (await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return await this.miguMusicApi.scrSearch(keywords, {
                            proxy: proxyPool.getRandomProxy("CN") || undefined,
                            rows: limit,
                        });
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return await this.miguMusicApi.scrSearch(keywords, { rows: limit });
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

                const playbackSources = (track.mp3 && [new PlaybackSource([track.mp3], {
                    quality: 0,
                    statical: true,
                })]) || undefined;

                if (playbackSources) {
                    playbackSources.push(...playbackSources.filter((p) => p.urls
                        .reduce((matched: boolean, u) => matched || /^\s*http:/.test(u), false))
                        .map((p) => new PlaybackSource(p.urls.map((u) => u.replace(/^\s*http:/, "https:")), {
                            cached: p.cached,
                            quality: p.quality,
                            statical: p.statical,
                        })));
                }

                return new Track(track.id, track.title || track.songName.replace(/\((:?\S|\s)+\)/, ""), [
                    new Artist(track.artist || track.singerName),
                ], source, {
                    picture: track.cover,
                    playbackSources,
                });
            }
        }(tracks);
    }

    public async getRecommends(source: Source, track: Track, { playbackQuality = 0, abortSignal }: IOptions = {}) {
        const tracks = await (async () => {
            if (track) {
                return null;
            }

            const lists = await this.getLists(source);
            const randomList = lists[Math.floor(lists.length * Math.random())];

            if (randomList) {
                return (await this.getList(randomList.id, source, { playbackQuality, abortSignal }));
            }

            return null;
        })();

        if (!tracks || !tracks.length) {
            return await super.getRecommends(source, track, { playbackQuality, abortSignal });
        }

        return tracks;
    }

    public async getLists(source: Source) {
        return [new List("23603721", "咪咕官方榜", source)];
    }

    public async getList(id: string, source: Source, { playbackQuality, limit, offset, abortSignal }: IOptions = {}) {
        const tracks = await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return (await this.miguMusicApi.getCmsList(id, {
                            abortSignal,

                            pageNo: typeof offset === "number"
                                && typeof limit === "number" ? Math.floor(offset / limit) : undefined,

                            pageSize: limit,
                            proxy: this.proxyPool.getRandomProxy("CN") || undefined,
                        })) || null;
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return (await this.miguMusicApi.getCmsList(id, {
                        abortSignal,

                        pageNo: typeof offset === "number"
                            && typeof limit === "number" ? Math.floor(offset / limit) : undefined,

                        pageSize: limit,
                    })) || null;
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })();

        if (tracks) {
            return tracks.map(({ songData = {} }: { songData: any }) => {
                const playbackSources = [
                    songData.listenUrl,
                    // songData.lisCr,
                ].filter((url) => url).map((url) => new PlaybackSource(url, {
                    quality: 0,
                    statical: true,
                }));

                // if (playbackSources && playbackSources.length) {
                //     playbackSources.push(...playbackSources.filter((p) => p.urls
                //         .reduce((matched: boolean, u) => matched || /^\s*http:/.test(u), false))
                //         .map((r) => new PlaybackSource(r.urls.map((u) => u.replace(/^\s*http:/, "https:")), {
                //             cached: r.cached,
                //             quality: r.quality,
                //             statical: r.statical,
                //         })));
                // }

                return new Track(String(songData.songId), songData.songName,
                    songData.singerName.map((name: string) => new Artist(name)), source, {
                        picture: songData.picS,
                        playbackSources,
                    });
            });
        }

        return null;
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IOptions = {}) {
        return (await this.search([
            track.name,
            ...track.artists.map((a) => a.name),
        ].join(","), source, { playbackQuality, limit })).values();
    }
}
