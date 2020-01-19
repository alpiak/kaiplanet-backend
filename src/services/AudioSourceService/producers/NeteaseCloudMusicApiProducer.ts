import IOptions from "../IMethodOptions";
import IProducer from "../IProducer";

import Artist from "../Artist";
import Instance from "../Instance";
import List from "../List";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import NeteaseCloudMusicApi from "../../../libraries/audioSource/NeteaseCloudMusicApi";

import { getConfig, retry } from "../utils";

const config = getConfig();

class NeteaseCloudMusicApiTrackList extends TrackList<any> {
    private readonly source: Source;
    private readonly playbackQuality: number;

    constructor(tracks: Track[], source: Source, { playbackQuality = 0 } = {}) {
        super(tracks);

        this.source = source;
        this.playbackQuality = playbackQuality;
    }

    public async get(index: number) {
        const track = this.tracks[index];

        if (!track) {
            return null;
        }

        const picture = track.picture || await this.getPicture(track);

        return new Track(String(track.id), track.name, track.artists.map((a: any) => new Artist(a.name)), this.source, {
                duration: track.duration,
                picture: picture || undefined,
            });
    }

    protected async getPicture(track: Track): Promise<string|null> {
        return null;
    }
}

export default class NeteaseCloudMusicApiProducer extends Producer implements IProducer {
    public static readonly sources = [Source.netEase];
    public static readonly instances = config.producers.neteaseCloudMusicApi.instances
        .map((instance: any) => new Instance(instance.host, instance.port, instance.protocol));

    private static listName = new Map([
        [Source.netEase, ["云音乐热歌榜", "美国Billboard周榜", "日本Oricon周榜", "韩国Mnet排行榜周榜", "台湾Hito排行榜",
            "中国TOP排行榜(内地榜)"]],
    ]);

    private readonly neteaseCloudMusicApi: NeteaseCloudMusicApi;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();
        this.neteaseCloudMusicApi = new NeteaseCloudMusicApi(host, port, protocol);
    }

    public async search(keywords: string, source: Source, { playbackQuality = 0, limit, abortSignal }: IOptions = {}) {
        const proxyPool = this.proxyPool;

        const tracks = (await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return await this.neteaseCloudMusicApi.searchSongs(keywords, {
                            abortSignal,
                            limit,
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
                    return await this.neteaseCloudMusicApi.searchSongs(keywords, {
                        abortSignal,
                        limit,
                    });
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })()) || [];

        const getPicture = (track: Track) => this.getPicture(track, { abortSignal });

        return new class extends NeteaseCloudMusicApiTrackList { // tslint:disable-line
            protected async getPicture(track: Track) {
                try {
                    return await getPicture(track);
                } catch {
                    return super.getPicture(track);
                }
            }
        }(tracks, source, { playbackQuality });
    }

    public async getPlaybackSources(id: string, source: Source, { playbackQuality = 0 } = {}) {
        const playbackSources = await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return (await this.neteaseCloudMusicApi.getSongURL(id, { proxy: this.proxyPool.getRandomProxy("CN") || undefined }))
                            .map((track: any) => track.url)
                            .filter((url: string) => url)
                            .map((url: string) => new PlaybackSource([url], { quality: 0 }));
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return (await this.neteaseCloudMusicApi.getSongURL(id))
                        .map((track: any) => track.url)
                        .filter((url: string) => url)
                        .map((url: string) => new PlaybackSource([url], { quality: 0 }));
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })();

        // playbackSources.push(...playbackSources.filter((playbackSource: PlaybackSource) => playbackSource.urls
        //     .reduce((matched, url) => matched || /^\s*http:/.test(url), false))
        //     .map((playbackSource: PlaybackSource) =>
        //         new PlaybackSource(playbackSource.urls.map((url) => url.replace(/^\s*http:/, "https:")), {
        //             cached: playbackSource.cached,
        //             quality: playbackSource.quality,
        //             statical: playbackSource.statical,
        //         })));
        //
        // return playbackSources;

        return playbackSources.map((playbackSource: PlaybackSource) =>
            new PlaybackSource(playbackSource.urls.map((url) => url.replace(/^\s*http:/, "https:")), {
                cached: playbackSource.cached,
                quality: playbackSource.quality,
                statical: playbackSource.statical,
            }));
    }

    public async getRecommends(source: Source, inputTrack: Track, { playbackQuality = 0, abortSignal }: IOptions = {}) {
        const tracks = await (async () => {
            if (inputTrack) {
                const matchedTrack = await (await this.search([
                    inputTrack.name,
                    ...inputTrack.artists.map((artist) => artist.name),
                ].join(","), source, {
                    abortSignal,
                    limit: 1,
                    playbackQuality,
                })).get(0);

                return await (async (track) => {
                    if (track) {
                        try {
                            return await retry(async () => {
                                try {
                                    return (await this.neteaseCloudMusicApi.getSimiSong(track.id, {
                                        abortSignal,
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
                                return (await this.neteaseCloudMusicApi.getSimiSong(track.id, { abortSignal })) || null;
                            } catch (e) {
                                // console.log(e);

                                throw e;
                            }
                        }
                    } else {
                        return null;
                    }
                })(matchedTrack);
            }

            const lists = await this.getLists(source, { abortSignal });
            const randomList = lists[Math.floor(lists.length * Math.random())];

            if (randomList) {
                return (await this.getList(randomList.id, source, {
                    abortSignal,
                    playbackQuality,
                }));
            }

            return null;
        })();

        if (!tracks || !tracks.length) {
            return await super.getRecommends(source, inputTrack, { playbackQuality, abortSignal });
        }

        const getPicture = (track: Track) => this.getPicture(track, { abortSignal });

        const trackList = new class extends NeteaseCloudMusicApiTrackList { // tslint:disable-line
            protected async getPicture(track: Track) {
                try {
                    return await getPicture(track);
                } catch (e) {
                    return super.getPicture(track);
                }
            }
        }(tracks, source, { playbackQuality });

        const randomTrack = await trackList.get(Math.floor(trackList.length * Math.random()));

        return randomTrack ? [randomTrack] : null;
    }

    public async getLists(source: Source, { abortSignal }: IOptions = {}) {
        try {
            try {
                return await retry(async () => {
                    try {
                        return (await this.neteaseCloudMusicApi.getToplist({
                            abortSignal,
                            proxy: this.proxyPool.getRandomProxy("CN") || undefined,
                        })).map(({ id, name }: { id: string, name: string }) => new List(id, name, source));
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return (await this.neteaseCloudMusicApi.getToplist({ abortSignal }))
                        .map(({ id, name }: { id: string, name: string }) => new List(id, name, source));
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        } catch {
            const listNames = NeteaseCloudMusicApiProducer.listName.get(source);

            if (!listNames) {
                throw new Error("No list existing.");
            }

            return (await Promise.all(listNames.map(async (listName) => {
                return (await (async () => {
                    try {
                        return await retry(async () => {
                            try {
                                return await this.neteaseCloudMusicApi.searchPlaylist(listName, {
                                    abortSignal,
                                    limit: 0,
                                    proxy: this.proxyPool.getRandomProxy("CN") || undefined,
                                });
                            } catch (e) {
                                // console.log(e);

                                throw e;
                            }
                        }, this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                    } catch (e) {
                        // console.log(e);

                        try {
                            return await this.neteaseCloudMusicApi.searchPlaylist(listName, {
                                abortSignal,
                                limit: 0,
                            });
                        } catch (e) {
                            // console.log(e);

                            throw e;
                        }
                    }
                })())[0] || null;
            })))
            .filter((playlist) => playlist)
            .map((playlist) => {
                const { id, name } = playlist;

                return new List(id, name, source);
            });
        }
    }

    public async getList(id: string, source: Source, { playbackQuality, limit, offset, abortSignal }: IOptions = {}) {
        const tracks = await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return (await this.neteaseCloudMusicApi.getPlaylistDetail(id, {
                            abortSignal,
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
                    return (await this.neteaseCloudMusicApi.getPlaylistDetail(id, { abortSignal })) || null;
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })();

        if (tracks) {
            return tracks.map((track: any) => new Track(String(track.id), track.name,
                track.ar.map((artist: Artist) => new Artist(artist.name)), source, {
                    duration: track.dt,
                    picture: track.al && track.al.picUrl,
                }));
        }

        return null;
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IOptions = {}) {
        return (await this.search([
            track.name,
            ...track.artists.map((artist) => artist.name),
        ].join(","), source, { playbackQuality, limit })).values();
    }

    public async getTrack(id: string, source: Source, { playbackQuality = 0 } = {}) {
        const track = await retry(async () => {
            try {
                return (await this.neteaseCloudMusicApi.getSongDetail([String(id)], {
                    proxy: this.proxyPool.getRandomProxy("CN") || undefined,
                }))[0];
            } catch (e) {
                // console.log(e);

                throw e;
            }
        }, this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);

        if (track) {
            const playbackSources = await this.getPlaybackSources(track.id, source);

            return new Track(String(track.id), track.name, track.ar.map((artist: Artist) => new Artist(artist.name)),
                source, {
                    duration: track.dt,
                    picture: (track.al && track.al.picUrl) || undefined,
                    playbackSources: playbackSources && playbackSources.length ? playbackSources : undefined,
                });
        }

        return null;
    }

    private async getPicture(track: Track, { abortSignal }: { abortSignal?: AbortSignal } = {}) {
        try {
            return await retry(async () => {
                const details = await (async () => {
                    try {
                        return (await this.neteaseCloudMusicApi.getSongDetail([String(track.id)], {
                            abortSignal,
                            proxy: this.proxyPool.getRandomProxy("CN") || undefined,
                        }))[0];
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                })();

                return (details && details.al && details.al.picUrl && details.al.picUrl.replace(/^\s*http:/, "https:"))
                    || null;
            }, this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
        } catch (e) {
            // console.log(e);

            const details = await (async () => {
                try {
                    return (await this.neteaseCloudMusicApi.getSongDetail([String(track.id)], { abortSignal }))[0];
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            })();

            return (details && details.al && details.al.picUrl && details.al.picUrl.replace(/^\s*http:/, "https:"))
                || null;
        }
    }
}
