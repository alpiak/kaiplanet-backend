const musicAPI = require("music-api");

module.exports = ({ Artist, Track, TrackList, List, Producer, Source }) => class MusicApiProducer extends Producer {
    static _sources = [Source.netEase, Source.qq];

    static get sources() {
        return MusicApiProducer._sources;
    }

    static _listNames = new Map([
        [Source.netEase, ["云音乐热歌榜", "美国Billboard周榜", "日本Oricon周榜", "韩国Mnet排行榜周榜", "台湾Hito排行榜",
            "中国TOP排行榜(内地榜)"]],
        [Source.qq, []],
    ]);

    async search(keywords, source, { limit, playbackQuality = 0 } = {}) {
        const tracks = (await (() => {
            try {
                return musicAPI.searchSong(source.id, {
                    key: keywords,
                    limit
                });
            } catch (e) {
                throw e;
            }
        })()).songList || [];

        return new class extends TrackList {
            get(index) {
                const track = this._tracks[index];

                if (!track) {
                    return null;
                }

                return new Track(String(track.id), track.name, +track.duration, track.artists.map(artist => new Artist(artist.name)), track.album.coverBig && track.album.coverBig.replace(/^https/, 'http'), source);
            }
        }(tracks);
    }

    async getPlaybackSources(id, source, { playbackQuality = 0 } = {}) {
        try {
            const url = (await musicAPI.getSong(source, { id, br: 128000 })).url;
            const playbackSources = url ? [new Track.PlaybackSource([url], 0)] : [];

            // playbackSources.push(...playbackSources.filter((playbackSource) => playbackSource.urls
            //     .reduce((matched, url) => matched || /^\s*http:/.test(url), false))
            //     .map((playbackSource) => new Track.PlaybackSource(playbackSource.urls.map((url) => url.replace(/^\s*http:/, "https:")), {
            //         quality: playbackSource.quality,
            //         statical: playbackSource.statical,
            //         cached: playbackSource.cached,
            //     })));
            //
            // return playbackSources;

            return playbackSources.map((playbackSource) => new Track.PlaybackSource(playbackSource.urls.map((url) => url.replace(/^\s*http:/, "https:")), {
                quality: playbackSource.quality,
                statical: playbackSource.statical,
                cached: playbackSource.cached,
            }));
        } catch (e) {
            console.log(e);

            return [];
        }
    }

    // async getRecommends(track, source, { playbackQuality = 0 } = {}) {
    //     const tracks = (() => {
    //         if (source === Source.netEase) {
    //             return (async () => {
    //                 const res = await (() => {
    //                     try {
    //                         return musicAPI.searchPlaylist(source.id, { key: MusicApiProducer._listNames.get(source)[0] })
    //                     } catch (e) {
    //                         throw e;
    //                     }
    //                 })();
    //
    //                 if (res && res.success === true && res.playlists && res.playlists[0]) {
    //                     try {
    //                         return (await musicAPI.getPlaylist(source.id, { id: res.playlists[0].id })).songList || null;
    //                     } catch (e) {
    //                         throw e;
    //                     }
    //                 }
    //
    //                 return null;
    //             })();
    //         } else if (source === Source.qq) {
    //             // return (async () => {
    //             //     let err = new Error();
    //             //     let i = 0;
    //             //
    //             //     while(i++ < 10) {
    //             //         try {
    //             //             return (await musicAPI.getPlaylist(source.id, { id: new String(i) })).songList || null;
    //             //         } catch (e) {
    //             //             err = e;
    //             //         }
    //             //     }
    //             //
    //             //     throw err;
    //             // })();
    //             return null;
    //         }
    //
    //         return null;
    //     })();
    //
    //     if (!tracks || !tracks.length) {
    //         return null;
    //     }
    //
    //     return tracks.map((track) => new Track(String(track.id), track.name, +track.duration, track.artists.map(artist => new Artist(artist.name)), track.album.coverBig && track.album.coverBig.replace(/^https/, 'http'), source));
    // }

    async getLists(source) {
        if (source === Source.qq) {
            return null;
        }

        return (await Promise.all(MusicApiProducer._listNames.get(source)
            .map(async (listName) => {
                const res = await (async () => {
                    try {
                        return await musicAPI.searchPlaylist(source.id, { key: listName })
                    } catch (e) {
                        return null;
                    }
                })();

                if (res && res.success === true) {
                    return res.playlists ? res.playlists[0] : null;
                }

                return null;
            })))
            .filter((playlist) => playlist)
            .map((playlist) => {
                const { id, name } = playlist;

                return new List(id, name, source);
            });
    }

    async getList(id, source, { playbackQuality = 0, limit, offset } = {}) {
        const res = await musicAPI.getPlaylist(source.id, { id: +id });

        if (res.success === true && res.songList) {
            return res.songList.map((track) => new Track(String(track.id), track.name, +track.duration, track.artists.map(artist => new Artist(artist.name)), track.album.coverBig && track.album.coverBig.replace(/^https/, 'http'), Source.netEase));
        }

        return null;
    }

    async getAlternativeTracks(track, source, { playbackQuality = 0, limit } = {}) {
        return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { playbackQuality, limit })).values();
    }
};
