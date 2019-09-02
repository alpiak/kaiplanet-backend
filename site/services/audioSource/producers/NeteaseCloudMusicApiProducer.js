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
            const tracks = (await (async () => {
                try {
                    return await this._neteaseCloudMusicApi.searchSongs(keywords, { limit });
                } catch (e) {
                    throw e;
                }
            })()) || [];

            const getPicture = (track) => this._getPicture(track);

            return new class extends NeteaseCloudMusicApiTrackList {
                async _getPicture(track) {
                    try {
                        return await getPicture(track);
                    } catch (e) {
                        return super._getPicture(track);
                    }
                };
            }(tracks, source);
        }

        async getStreamUrls(id, source) {
            try {
                return (await this._neteaseCloudMusicApi.getSongURL(id)).map((track) => track.url || null);
            } catch (e) {
                return [];
            }
        }

        async getRecommend(track, source) {
            const matchedTrack = await (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { limit: 1 })).get(0);

            const tracks = await (async (track) => {
                if (track) {
                    try {
                        return (await this._neteaseCloudMusicApi.getSimiSong(track.id)) || null;
                    } catch (e) {
                        throw e;
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
                return (await this._neteaseCloudMusicApi.getToplist()).map(({ id, name }) => new List(id, name, source));
            } catch {
                return (await Promise.all(NeteaseCloudMusicApiProducer._listNames.get(source)
                    .map(async (listName) => {
                        return (await (() => {
                            try {
                                return this._neteaseCloudMusicApi.searchPlaylist(listName, { limit: 0 });
                            } catch (e) {
                                throw e;
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
                    return (await this._neteaseCloudMusicApi.getPlaylistDetail(id)) || null;
                } catch (e) {
                    throw e;
                }
            })();

            if (tracks) {
                return tracks.map((track) => new Track(track.id, track.name, track.dt, track.ar.map((artist) => new Artist(artist.name)), track.al && track.al.picUrl, source));
            }

            return null;
        }

        async getAlternativeTracks(track, source, { limit } = {}) {
            return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { limit })).values();
        }

        async _getPicture(track) {
            try {
                const details = (await this._neteaseCloudMusicApi.getSongDetail([String(track.id)]))[0];

                return (details && details.al && details.al.picUrl) || null;
            } catch (e) {
                throw e;
            }
        }
    }
};
