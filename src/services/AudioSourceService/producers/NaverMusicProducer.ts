import IOptions from "../IMethodOptions";
import IProducer from "../IProducer";

import BrowserService from "../../BrowserService";

import Artist from "../Artist";
import Instance from "../Instance";
import List from "../List";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import NaverMusic from "../../../libraries/audioSource/NaverMusic";

import { getConfig, retry } from "../utils";

const config = getConfig();

export default class NaverMusicProducer extends Producer implements IProducer {
    public static readonly sources = [Source.naver];

    public static readonly instances = config.producers.naverMusic.instances
        .map(({ host, port, protocol }: any) => new Instance(host, port, protocol));

    public browserService!: BrowserService;

    private readonly naverMusic: NaverMusic;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();

        this.naverMusic = new NaverMusic(host, port, protocol, { userAgent: config.producers.naverMusic.userAgent });
    }

    public async search(keywords: string, source: Source, { offset, limit, playbackQuality = 0 }: IOptions = {}) {
        const proxyPool = this.proxyPool;

        const tracks = (await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return await this.naverMusic.search(keywords, {
                            browserPageInstance: await this.browserService.createBrowserPage({
                                proxy: proxyPool.getRandomProxy("KR") || undefined,
                            }),
                            page: (typeof offset === "number" && typeof limit === "number") ? Math.ceil(offset / limit)
                                : 1,
                        });
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, proxyPool.getRandomProxy("KR") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return await this.naverMusic.search(keywords, {
                        browserPageInstance: await this.browserService.createBrowserPage(),
                        page: (typeof offset === "number" && typeof limit === "number") ? Math.ceil(offset / limit) : 1,
                    });
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })()) || [];

        const that = this;

        return new class extends TrackList<any> { // tslint:disable-line
            public async get(index: number) {
                const track = this.tracks[index];

                if (!track) {
                    return null;
                }

                const picture = (await (async () => {
                    try {
                        return await retry(async () => {
                            try {
                                return await that.naverMusic.getAlbum(track.albumId, {
                                    browserPageInstance: await that.browserService.createBrowserPage({
                                        proxy: proxyPool.getRandomProxy("KR") || undefined,
                                    }),
                                });
                            } catch (e) {
                                // console.log(e);

                                throw e;
                            }
                        }, proxyPool.getRandomProxy("KR") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                    } catch (e) {
                        // console.log(e);

                        try {
                            return await that.naverMusic.getAlbum(track.albumId, {
                                browserPageInstance: await that.browserService.createBrowserPage(),
                            });
                        } catch (e) {
                            // console.log(e);

                            throw e;
                        }
                    }
                })()).image;

                return new Track(track.id, track.name, track.artists.map((a: any) => new Artist(a.replace(/(?<=\S+)\s*\((?:\S|\s)+\)\s*/, ""), {
                    aliases: (() => {
                        const aliasResult = /\S+\s*\(((?:\S|\s)+?)\)/.exec(a);

                        return (aliasResult && aliasResult[1]) ? [aliasResult[1]] : undefined;
                    })(),
                })), source, {
                    picture: picture || undefined,
                });
            }
        }(tracks);
    }

    public async getLists(source: Source, { abortSignal }: IOptions = {}) {
        return await Promise.all(NaverMusic.TOP_ONE_HUNDERD_DOMAINS.map(async (d) => {
            const list = await (async () => {
                try {
                    return await retry(async () => {
                        try {
                            return (await this.naverMusic.getTop100(d, {
                                abortSignal,
                                browserPageInstance: await this.browserService.createBrowserPage({
                                    proxy: this.proxyPool.getRandomProxy("KR") || undefined,
                                }),
                            })) || null;
                        } catch (e) {
                            // console.log(e);

                            throw e;
                        }
                    }, this.proxyPool.getRandomProxy("KR") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                } catch (e) {
                    // console.log(e);

                    try {
                        return (await this.naverMusic.getTop100(d, {
                            abortSignal,
                            browserPageInstance: await this.browserService.createBrowserPage(),
                        })) || null;
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }
            })();

            if (list && list.title) {
                return new List(d, list.title, source);
            }
        }).filter((list) => list)) as List[];
    }

    public async getList(id: string, source: Source, { playbackQuality, limit, offset, abortSignal }: IOptions = {}) {
        const listPromise = (async () => {
            try {
                return await retry(async () => {
                    try {
                        return (await this.naverMusic.getTop100(id, {
                            abortSignal,
                            browserPageInstance: await this.browserService.createBrowserPage({
                                proxy: this.proxyPool.getRandomProxy("KR") || undefined,
                            }),
                        })) || null;
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, this.proxyPool.getRandomProxy("KR") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return (await this.naverMusic.getTop100(id, {
                        abortSignal ,
                        browserPageInstance: await this.browserService.createBrowserPage(),
                    })) || null;
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })();

        const thumbsPromise = (async () => {
            try {
                return await retry(async () => {
                    try {
                        return (await this.naverMusic.getTop100Thumbs(id, {
                            abortSignal,
                            browserPageInstance: await this.browserService.createBrowserPage({
                                proxy: this.proxyPool.getRandomProxy("KR") || undefined,
                            }),
                        })) || null;
                    } catch (e) {
                        // console.log(e);

                        throw e;
                    }
                }, this.proxyPool.getRandomProxy("KR") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                // console.log(e);

                try {
                    return (await this.naverMusic.getTop100Thumbs(id, {
                        abortSignal ,
                        browserPageInstance: await this.browserService.createBrowserPage(),
                    })) || null;
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })();

        const list = await listPromise;

        if (list && list.tracks) {
            const thumbs = await thumbsPromise;

            list.tracks.forEach((t: any) => {
                if (thumbs[t.id]) {
                    t.thumb = thumbs[t.id];
                }
            });

            return list.tracks.map((t: any) =>
                new Track(t.id, t.name, t.artists.map((a: any) => new Artist(a.replace(/(?<=\S+)\s*\((?:\S|\s)+\)\s*/, ""), {
                    aliases: (() => {
                        const aliasResult = /\S+\s*\(((?:\S|\s)+?)\)/.exec(a);

                        return (aliasResult && aliasResult[1]) ? [aliasResult[1]] : undefined;
                    })(),
                })), source, { picture: t.thumb }));
        }

        return null;
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IOptions = {}) {
        return await (await this.search([
            track.name,

            ...track.artists.map((a) => a.name),
        ].join(","), source, { playbackQuality, limit })).values();
    }
}
