const { retry } = require("../utils");

const NeteaseCloudMusicApi = require("../../../libraries/audioSource/NeteaseCloudMusicApi")();

module.exports = ({ Artist, Track, TrackList, List, Source, Producer, config }) => {
    class NeteaseCloudMusicApiTrackList extends TrackList {
        _source;

        constructor(tracks, source) {
            super(tracks);
            this._source = source;
        }

        async get(index) {
            const track = this._tracks[index];

            if (!track) {
                return null;
            }

            const picture = await this._getPicture(track);

            return new Track(String(track.id), track.name, track.duration, track.artists.map((artist) => new Artist(artist.name)), picture, this._source);
        }

        _getPicture() {
            return null;
        }
    }

    return class NeteaseCloudMusicApiProducer extends Producer {
        static get sources() {
            return NeteaseCloudMusicApiProducer._sources;
        }

        static get instances() {
            return NeteaseCloudMusicApiProducer._instances;
        }

        static _sources = [Source.netEase];
        static _instances = config.producers.neteaseCloudMusicApi.instances.map((instance) => new Producer.Instance(instance.host, instance.port, instance.protocol));

        static _listNames = new Map([
            [Source.netEase, ["云音乐热歌榜", "美国Billboard周榜", "日本Oricon周榜", "韩国Mnet排行榜周榜", "台湾Hito排行榜",
                "中国TOP排行榜(内地榜)"]],
        ]);

        _neteaseCloudMusicApi;

        constructor(host, port, protocol) {
            super(host, port, protocol);
            this._neteaseCloudMusicApi = new NeteaseCloudMusicApi(host, port, protocol);
        }

        async search(keywords, source, { limit } = {}) {
            const proxyPool = this._proxyPool;

            const tracks = (await (async () => {
                try {
                    return await retry(async () => {
                        try {
                            return await this._neteaseCloudMusicApi.searchSongs(keywords, {
                                limit,
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
                        return await this._neteaseCloudMusicApi.searchSongs(keywords, { limit });
                    } catch (e) {
                        console.log(e);

                        throw e;
                    }
                }
            })()) || [];

            const getPicture = (track) => this._getPicture(track);

            return new class extends NeteaseCloudMusicApiTrackList {
                async _getPicture(track) {
                    try {
                        return await getPicture(track);
                    } catch {
                        return super._getPicture(track);
                    }
                };
            }(tracks, source);
        }

        async getStreamUrls(id, source) {
            try {
                try {
                    return await retry(async () => {
                        try {
                            return (await this._neteaseCloudMusicApi.getSongURL(id, { proxy: this._proxyPool.getRandomProxy("CN") })).map((track) => track.url || null);
                        } catch (e) {
                            console.log(e);

                            throw e;
                        }
                    }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                } catch (e) {
                    console.log(e);

                    try {
                        return (await this._neteaseCloudMusicApi.getSongURL(id)).map((track) => track.url || null);
                    } catch (e) {
                        console.log(e);

                        throw e;
                    }
                }
            } catch (e) {
                console.log(e);

                return [];
            }
        }

        async getRecommend(track, source) {
            const matchedTrack = await (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { limit: 1 })).get(0);

            const tracks = await (async (track) => {
                if (track) {
                    try {
                        return await retry(async () => {
                            try {
                                return (await this._neteaseCloudMusicApi.getSimiSong(track.id, { proxy: this._proxyPool.getRandomProxy("CN") })) || null;
                            } catch (e) {
                                console.log(e);

                                throw e;
                            }
                        }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                    } catch (e) {
                        console.log(e);

                        try {
                            return (await this._neteaseCloudMusicApi.getSimiSong(track.id)) || null;
                        } catch (e) {
                            console.log(e);

                            throw e;
                        }
                    }
                } else {
                    return null;
                }
            })(matchedTrack);

            if (!tracks || !tracks.length) {
                return null;
            }

            const getPicture = (track) => this._getPicture(track);

            const trackList = new class extends NeteaseCloudMusicApiTrackList {
                async _getPicture(track) {
                    try {
                        return await getPicture(track);
                    } catch (e) {
                        return super._getPicture(track);
                    }
                }
            }(tracks, source);

            return trackList.get(Math.floor(trackList.length * Math.random())) || null;
        }

        async getLists(source) {
            try {
                try {
                    return await retry(async () => {
                        try {
                            return (await this._neteaseCloudMusicApi.getToplist({ proxy: this._proxyPool.getRandomProxy("CN") })).map(({ id, name }) => new List(id, name, source));
                        } catch (e) {
                            console.log(e);

                            throw e;
                        }
                    }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                } catch (e) {
                    console.log(e);

                    try {
                        return (await this._neteaseCloudMusicApi.getToplist()).map(({ id, name }) => new List(id, name, source));
                    } catch (e) {
                        console.log(e);

                        throw e;
                    }
                }
            } catch {
                return (await Promise.all(NeteaseCloudMusicApiProducer._listNames.get(source)
                    .map(async (listName) => {
                        return (await (async () => {
                            try {
                                return await retry(async () => {
                                    try {
                                        return await this._neteaseCloudMusicApi.searchPlaylist(listName, {
                                            limit: 0,
                                            proxy: proxyPool.getRandomProxy("CN"),
                                        });
                                    } catch (e) {
                                        console.log(e);

                                        throw e;
                                    }
                                }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                            } catch (e) {
                                console.log(e);

                                try {
                                    return await this._neteaseCloudMusicApi.searchPlaylist(listName, { limit: 0 });
                                } catch (e) {
                                    console.log(e);

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

        async getList(id, source, { limit, offset } = {}) {
            const tracks = await (async () => {
                try {
                    return await retry(async () => {
                        try {
                            return (await this._neteaseCloudMusicApi.getPlaylistDetail(id, { proxy: this._proxyPool.getRandomProxy("CN") })) || null;
                        } catch (e) {
                            console.log(e);

                            throw e;
                        }
                    }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
                } catch (e) {
                    console.log(e);

                    try {
                        return (await this._neteaseCloudMusicApi.getPlaylistDetail(id)) || null;
                    } catch (e) {
                        console.log(e);

                        throw e;
                    }
                }
            })();

            if (tracks) {
                return tracks.map((track) => new Track(String(track.id), track.name, track.dt, track.ar.map((artist) => new Artist(artist.name)), track.al && track.al.picUrl, source));
            }

            return null;
        }

        async getAlternativeTracks(track, source, { limit } = {}) {
            return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { limit })).values();
        }

        async getTrack(id, source) {
            const track = await retry(async () => {
                try {
                    return (await this._neteaseCloudMusicApi.getSongDetail([String(id)], { proxy: this._proxyPool.getRandomProxy("CN")}))[0];
                } catch (e) {
                    console.log(e);

                    throw e;
                }
            }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);

            if (track) {
                const streamUrls = await this.getStreamUrls(track.id, source);


                return new Track(String(track.id), track.name, track.dt, track.ar.map((artist) => new Artist(artist.name)), (track.al && track.al.picUrl) || undefined, source, streamUrls && streamUrls.length ? streamUrls : undefined);
            }

            return null;
        }

        async _getPicture(track) {
            try {
                return await retry(async () => {
                    const details = await (async () => {
                        try {
                            return (await this._neteaseCloudMusicApi.getSongDetail([String(track.id)], { proxy: this._proxyPool.getRandomProxy("CN")}))[0];
                        } catch (e) {
                            console.log(e);

                            throw e;
                        }
                    })();

                    return (details && details.al && details.al.picUrl) || null;
                }, this._proxyPool.getRandomProxy("CN") ? Producer.PROXY_RETRY_TIMES + 1 : 1);
            } catch (e) {
                console.log(e);

                const details = await (async () => {
                    try {
                        return (await this._neteaseCloudMusicApi.getSongDetail([String(track.id)]))[0];
                    } catch (e) {
                        console.log(e);

                        throw e;
                    }
                })();

                return (details && details.al && details.al.picUrl) || null;
            }
        }
    }
};
