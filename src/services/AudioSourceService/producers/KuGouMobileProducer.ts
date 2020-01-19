import KuGouMobile from "../../../libraries/audioSource/KuGouMobile";

import IOptions from "../IMethodOptions";

import Artist from "../Artist";
import Instance from "../Instance";
import List from "../List";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";

import { getConfig, retry } from "../utils";

const config = getConfig();

export default class KuGouMobileProducer extends Producer {
    public static readonly sources = [Source.kugou];

    public static readonly instances = config.producers.kuGouMobile.instances
        .map((i: any) => new Instance(i.host, i.port, i.protocol));

    private readonly kuGouMobile: KuGouMobile;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();
        this.kuGouMobile = new KuGouMobile(host, port, protocol);
    }

    public async getRecommends(source: Source, track: Track, { playbackQuality = 0, abortSignal }: IOptions = {}) {
        if (!track) {
            const tracks = await (async () => {
                const lists = await this.getLists(source, { abortSignal });
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

        return await super.getRecommends(source, track, { playbackQuality, abortSignal });
    }

    public async getLists(source: Source, { abortSignal }: { abortSignal?: AbortSignal} = {}) {
        try {
            return await retry(async () => {
                try {
                    return (await this.kuGouMobile.getRankList({
                        abortSignal,
                        proxy: this.proxyPool.getRandomProxy("CN") || undefined,
                    })).map(({ rankid, rankname }: { rankid: string, rankname: string }) =>
                        new List(rankid, rankname, source));
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }, this.proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
        } catch (e) {
            // console.log(e);

            try {
                return (await this.kuGouMobile.getRankList({ abortSignal }))
                    .map(({ rankid, rankname }: { rankid: string, rankname: string }) =>
                        new List(rankid, rankname, source));
            } catch (e) {
                // console.log(e);

                throw e;
            }
        }
    }

    public async getList(id: string, source: Source, {
        playbackQuality = 0,
        limit,
        offset,
        abortSignal,
    }: IOptions = {}) {
        const tracks = await (async () => {
            try {
                return await retry(async () => {
                    try {
                        return (await this.kuGouMobile.getRankInfo(id, {
                            abortSignal,
                            page: typeof offset === "number"
                                && typeof limit === "number" ? Math.ceil(offset / limit) : undefined,
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
                    return (await this.kuGouMobile.getRankInfo(id, {
                        abortSignal,
                        page: typeof offset === "number"
                            && typeof limit === "number" ? Math.ceil(offset / limit) : undefined,
                    })) || null;
                } catch (e) {
                    // console.log(e);

                    throw e;
                }
            }
        })();

        if (tracks) {
            return tracks.map((track: any) => {
                const fields = track.filename.split("-").map((field: string) => field.trim());

                return new Track(track.hash, fields[fields.length - 1],
                    fields[0].split(/(?:、|,)/).map((singerName: string) => new Artist(singerName.trim())), source, {
                        duration: +track.duration * 1000,
                    });
            });
        }

        return null;
    }
}
