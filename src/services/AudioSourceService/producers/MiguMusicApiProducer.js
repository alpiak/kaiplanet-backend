const { retry } = require("../utils");

const MiguMusicApi = require("../../../libraries/audioSource/MiguMusicApi")();

module.exports = ({ Artist, Track, TrackList, List, Source, Producer, config }) => {
    return class MiguMusicApiProducer extends Producer {
        static get sources() {
            return MiguMusicApiProducer._sources;
        }

        static get instances() {
            return MiguMusicApiProducer._instances;
        }

        static _sources = [Source.migu];
        static _instances = config.producers.miguMusicApi.instances.map((instance) => new Producer.Instance(instance.host, instance.port, instance.protocol));

        _miguMusicApi;

        constructor(host, port, protocol) {
            super(host, port, protocol);
            this._miguMusicApi = new MiguMusicApi(host, port, protocol);
        }

        async search(keywords, source, { playbackQuality = 0, limit } = {}) {
            const proxyPool = this._proxyPool;

            const tracks = (await (async () => {
                try {
                    return await retry(async () => {
                        try {
                            return await this._miguMusicApi.scrSearch(keywords, {
                                rows: limit,
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
                        return await this._miguMusicApi.scrSearch(keywords, { rows: limit });
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

                    const playbackSources = (track.mp3 && [new Track.PlaybackSource([track.mp3], {
                        quality: 0,
                        statical: true,
                    })]) || undefined;

                    // if (playbackSources) {
                    //     playbackSources.push(...playbackSources.filter((playbackSource) => playbackSource.urls
                    //         .reduce((matched, url) => matched || /^\s*http:/.test(url), false))
                    //         .map((playbackSource) => new Track.PlaybackSource(playbackSource.urls.map((url) => url.replace(/^\s*http:/, "https:")), {
                    //             quality: playbackSource.quality,
                    //             statical: playbackSource.statical,
                    //             cached: playbackSource.cached,
                    //         })));
                    // }

                    return new Track(track.id, track.title || track.songName.replace(/\((:?\S|\s)+\)/, ""), undefined, [new Artist(track.artist || track.singerName)], track.cover, source, playbackSources);
                }
            }(tracks);
        }

        async getRecommends(track, source, { playbackQuality = 0, abortSignal } = {}) {
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
                return await super.getRecommends(track, source, { playbackQuality, abortSignal });
            }

            return tracks;
        }

        async getLists(source) {
            return [new List("23603721", "咪咕官方榜", source)];
        }

        async getList(id, source, { playbackQuality, limit, offset, abortSignal } = {}) {
            const tracks = await (async () => {
                try {
                    return await retry(async () => {
                        try {
                            return (await this._miguMusicApi.getCmsList(id, {
                                proxy: this._proxyPool.getRandomProxy("CN"),
                                pageSize: limit,
                                pageNo: Math.floor(offset / limit),
                                abortSignal,
                            })) || null;
                        } catch (e) {
                            console.log(e);

                            throw e;
                        }
                    }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                } catch (e) {
                    console.log(e);

                    try {
                        return (await this._miguMusicApi.getCmsList(id, {
                            pageSize: limit,
                            pageNo: Math.floor(offset / limit),
                            abortSignal,
                        })) || null;
                    } catch (e) {
                        console.log(e);

                        throw e;
                    }
                }
            })();

            if (tracks) {
                return tracks.map(({ songData = {} }) => {
                    const playbackSources = [songData.listenUrl/** , songData.lisCr **/].filter((url) => url).map((url) => new Track.PlaybackSource(url, {
                        quality: 0,
                        statical: true,
                    }));

                    // if (playbackSources && playbackSources.length) {
                    //     playbackSources.push(...playbackSources.filter((playbackSource) => playbackSource.urls
                    //         .reduce((matched, url) => matched || /^\s*http:/.test(url), false))
                    //         .map((playbackSource) => new Track.PlaybackSource(playbackSource.urls.map((url) => url.replace(/^\s*http:/, "https:")), {
                    //             quality: playbackSource.quality,
                    //             statical: playbackSource.statical,
                    //             cached: playbackSource.cached,
                    //         })));
                    // }

                    return new Track(String(songData.songId), songData.songName, undefined, songData.singerName.map((name) => new Artist(name)), songData.picS, source, playbackSources);
                });
            }

            return null;
        }

        async getAlternativeTracks(track, source, { playbackQuality = 0, limit } = {}) {
            return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { playbackQuality, limit })).values();
        }
    }
};
