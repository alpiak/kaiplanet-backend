import IOptions from "./IMethodOptions";
import IProducer from "./IProducer";

import PlaybackSource from "./PlaybackSource";
import Track from "./Track";
import TrackList from "./TrackList";

import { getConfig } from "./utils";

const config = getConfig();

export default class Source {
    public static readonly kaiPlanet = new Source("kaiplanet", "kaiplanet.net", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/kaiplanet.ico",
            `/proxy/${config.assetBaseUrl}/favicon.ico`,
            `${config.assetBaseUrl}/favicon.ico`,
        ],
    });

    public static readonly netEase = new Source("netease", "网易云音乐", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/netease.ico",
            "/proxy/https://s1.music.126.net/style/favicon.ico",
            `${config.assetBaseUrl}/netease.ico`,
            "https://s1.music.126.net/style/favicon.ico",
        ],
    });

    public static readonly qq = new Source("qq", "QQ音乐", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/qq.ico",
            "/proxy/https://y.qq.com/favicon.ico",
            `${config.assetBaseUrl}/qq.ico`,
            "https://y.qq.com/favicon.ico",
        ],
    });

    public static readonly soundCloud = new Source("soundcloud", "SoundCloud", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/soundcloud.ico",
            "/proxy/https://soundcloud.com/favicon.ico",
            `${config.assetBaseUrl}/soundcloud.ico`,
            "https://soundcloud.com/favicon.ico",
        ],
    });

    public static readonly naver = new Source("naver", "네이버 뮤직", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/naver.ico",
            "/proxy/https://www.naver.com/favicon.ico",
            `${config.assetBaseUrl}/naver.ico`,
            "https://www.naver.com/favicon.ico",
        ],
    });

    public static readonly qianQian = new Source("qianqian", "千千音乐", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/qianqian.ico",
            "/proxy/https://music.taihe.com/favicon.ico",
            `${config.assetBaseUrl}/qianqian.ico`,
            "https://music.taihe.com/favicon.ico",
        ],
    });

    public static readonly kugou = new Source("kugou", "酷狗音乐", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/kugou.png",
            "/proxy/https://www.kugou.com/yy/static/images/play/logo.png",
            `${config.assetBaseUrl}/kugou.ico`,
            "https://www.kugou.com/yy/static/images/play/logo.png",
            "/proxy/https://www.kugou.com/favicon.ico",
            "https://www.kugou.com/favicon.ico",
        ],
    });

    public static readonly kuwo = new Source("kuwo", "酷我音乐", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/kuwo.ico",
            "/proxy/https://kuwo.cn/favicon.ico",
            `${config.assetBaseUrl}/kuwo.ico`,
            "https://kuwo.cn/favicon.ico",
        ],
    });

    public static readonly migu = new Source("migu", "咪咕", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/migu.ico",
            "/proxy/https://www.migu.cn/favicon.ico",
            `${config.assetBaseUrl}/migu.ico`,
            "https://www.migu.cn/favicon.ico",
        ],
    });

    public static readonly hearthis =  new Source("hearthis", "hearthis.at", {
        icons: [
            "https://kai-player.oss-cn-shanghai.aliyuncs.com/hearthis.ico",
            "/proxy/https://hearthis.at/favicon.ico",
            `${config.assetBaseUrl}/hearthis.ico`,
            "https://hearthis.at/favicon.ico",
        ],
    });

    public static fromId(id: string) {
        if (id === undefined || id === null) {
            return null;
        }

        for (const key in Source) {
            if (!Source.hasOwnProperty(key)) {
                continue;
            }

            // @ts-ignore
            const source = Source[key];

            if (source instanceof Source && source.id === id) {
                return source;
            }
        }

        return null;
    }

    public static values() {
        const values = [];

        for (const key in Source) {
            if (!Source.hasOwnProperty(key)) {
                continue;
            }

            // @ts-ignore
            const source = Source[key];

            if (source instanceof Source) {
                values.push(source);
            }
        }

        return values;
    }

    public readonly id: string;
    public readonly name: string;
    public readonly producers: IProducer[] = [];
    public readonly icons: string[] = [];

    constructor(id: string, name: string, { icons }: { icons?: string[] } = {}) {
        this.id = id;
        this.name = name;

        if (icons) {
            this.icons = icons;
        }
    }

    public async getTrack(id: string, { playbackQuality = 0, producerRating }: IOptions = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const track = await producer.getTrack(id, this, { playbackQuality });

                if (track) {
                    return track;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    public async search(keywords: string, { limit, producerRating, playbackQuality = 0 }: IOptions = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const tracks = await producer.search(keywords, this, { limit, playbackQuality });

                if (tracks && tracks.length) {
                    return tracks;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return new TrackList();
    }

    public async getPlaybackSources(id: string, { producerRating, playbackQuality = 0 }: IOptions = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        const playbackSources = (await Promise.all(sortedProducers.map((p) => p.getPlaybackSources(id, this, {
            playbackQuality,
        }))))
            .flat()
            .filter((playbackSource) => playbackSource);

        if (!playbackSources || !playbackSources.length) {
            return null;
        }

        if (typeof producerRating !== "object" || !producerRating) {
            playbackSources.sort((a, b) => b.urls.join("").length - a.urls.join("").length);
        }

        const removeDuplicatedPlaybackSources = (playbackSourcesToRemoveDuplicatedOnes: PlaybackSource[]) => {
            const output: PlaybackSource[] = [];

            playbackSourcesToRemoveDuplicatedOnes.forEach((p) => {
                for (const outputPlaybackSource of output) {
                    for (const url of p.urls) {
                        if (outputPlaybackSource.urls.includes(url)) {
                            return;
                        }
                    }
                }

                output.push(p);
            });

            return output;
        };

        return removeDuplicatedPlaybackSources(playbackSources);
    }

    public async getLists({ limit, offset, producerRating }: IOptions = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const lists = await producer.getLists(this);

                if (lists && lists.length) {
                    return lists;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    public async getList(listId: string, { playbackQuality = 0, limit, offset, producerRating }: IOptions = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const list = await producer.getList(listId, this, { playbackQuality, limit, offset });

                if (list) {
                    return list;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    public async getRecommends(track: Track|null, { playbackQuality = 0, producerRating, abortSignal }: IOptions = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        if (track) {
            let getRecommendsError;

            for (const producer of sortedProducers) {
                try {
                    const recommendedTracks = await producer.getRecommends(this, track, {
                        abortSignal,
                        playbackQuality,
                    });

                    if (recommendedTracks && recommendedTracks.length) {
                        return recommendedTracks;
                    }
                } catch (e) {
                    getRecommendsError = e;
                }
            }

            if (getRecommendsError) {
                throw getRecommendsError;
            }

            return null;
        }

        let err;

        for (const producer of sortedProducers) {
            try {
                const recommendedTracks = await producer.getRecommends(this, track || undefined, {
                    abortSignal,
                    playbackQuality,
                });

                if (recommendedTracks && recommendedTracks.length) {
                    return recommendedTracks;
                }
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    public async getAlterTracks(track: Track, { playbackQuality = 0, limit, producerRating }: IOptions = {}) {
        const sortedProducers = producerRating ? this.getSortedProducers(producerRating) : this.producers;

        let err;

        for (const producer of sortedProducers) {
            try {
                const tracks = await producer.getAlterTracks(track, this, { playbackQuality, limit });

                return tracks || null;
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            throw err;
        }

        return null;
    }

    private getSortedProducers(producerRating: any) {
        if (typeof producerRating !== "object" || !producerRating) {
            return this.producers;
        }

        return [...this.producers].sort((a, b) => {
            const rankA = producerRating[a.id];
            const rankB = producerRating[b.id];

            if (typeof rankA !== "number" || typeof rankB !== "number") {
                return 0;
            }

            return rankA - rankB;

        });
    }
}
