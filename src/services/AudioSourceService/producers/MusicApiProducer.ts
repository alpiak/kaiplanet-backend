// @ts-ignore
import * as musicAPI from "music-api";

import IMethodOptions from "../IMethodOptions";

import Artist from "../Artist";
import List from "../List";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

export default class MusicApiProducer extends Producer {
    public static readonly sources = [Source.netEase, Source.qq];

    private static listNames = new Map([
        [Source.netEase, ["云音乐热歌榜", "美国Billboard周榜", "日本Oricon周榜", "韩国Mnet排行榜周榜", "台湾Hito排行榜",
            "中国TOP排行榜(内地榜)"]],
        [Source.qq, []],
    ]);

    public async search(keywords: string, source: Source, { limit, playbackQuality = 0 }: IMethodOptions = {}) {
        const tracks = (await (() => {
            try {
                return musicAPI.searchSong(source.id, {
                    key: keywords,
                    limit,
                });
            } catch (e) {
                throw e;
            }
        })()).songList || [];

        return new class extends TrackList<any> { // tslint:disable-line
            public async get(index: number) {
                const track = this.tracks[index];

                if (!track) {
                    return null;
                }

                return new Track(String(track.id), track.name, track.artists.map((a: any) => new Artist(a.name)),
                    source, {
                        duration: +track.duration,
                        picture: track.album.coverBig && track.album.coverBig.replace(/^https/, "http"),
                    });
            }
        }(tracks);
    }

    public async getPlaybackSources(id: string, source: Source, { playbackQuality = 0 } = {}) {
        try {
            const url = (await musicAPI.getSong(source, { id, br: 128000 })).url;
            const playbackSources = url ? [new PlaybackSource([url], { quality: 0 })] : [];

            // playbackSources.push(...playbackSources.filter((p) => p.urls
            //     .reduce((matched: boolean, u) => matched || /^\s*http:/.test(u), false))
            //     .map((p) => new PlaybackSource(p.urls.map((u) => u.replace(/^\s*http:/, "https:")), {
            //         cached: p.cached,
            //         quality: p.quality,
            //         statical: p.statical,
            //     })));
            //
            // return playbackSources;

            return playbackSources.map((playbackSource) => new PlaybackSource(playbackSource.urls.map((u) => u.replace(/^\s*http:/, "https:")), {
                cached: playbackSource.cached,
                quality: playbackSource.quality,
                statical: playbackSource.statical,
            }));
        } catch (e) {
            // console.log(e);

            return [];
        }
    }

    // public async getRecommends(source: Source, track: Track, { playbackQuality = 0 }: IMethodOptions = {}) {
    //     const tracks = await (() => {
    //         if (source === Source.netEase) {
    //             return (async () => {
    //                 const res = await (() => {
    //                     try {
    //                         const listNames = MusicApiProducer.listNames.get(source);
    //
    //                         return musicAPI.searchPlaylist(source.id, { key: listNames && listNames[0] });
    //                     } catch (e) {
    //                         throw e;
    //                     }
    //                 })();
    //
    //                 if (res && res.success === true && res.playlists && res.playlists[0]) {
    //                     try {
    //                         return (await musicAPI.getPlaylist(source.id, { id: res.playlists[0].id })).songList
    //                             || null;
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
    //             //     while (i++ < 10) {
    //             //         try {
    //             //             return (await musicAPI.getPlaylist(source.id, { id: String(i) })).songList || null;
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
    //     return tracks
    //         .map((t: any) => new Track(String(t.id), t.name, t.artists.map((a: any) => new Artist(a.name)), source, {
    //             duration: +t.duration,
    //             picture: t.album.coverBig && t.album.coverBig.replace(/^https/, "http"),
    //         }));
    // }

    public async getLists(source: Source) {
        if (source === Source.qq) {
            return null;
        }

        const listNames = MusicApiProducer.listNames.get(source);

        if (!listNames) {
            throw new Error("No list existing.");
        }

        return (await Promise.all(listNames
            .map(async (listName) => {
                const res = await (async () => {
                    try {
                        return await musicAPI.searchPlaylist(source.id, { key: listName });
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

    public async getList(id: string, source: Source, { playbackQuality = 0, limit, offset }: IMethodOptions = {}) {
        const res = await musicAPI.getPlaylist(source.id, { id: +id });

        if (res.success === true && res.songList) {
            return res.songList.map((t: any) => new Track(String(t.id), t.name,
                t.artists.map((a: any) => new Artist(a.name)), Source.netEase, {
                    duration: +t.duration,
                    picture: t.album.coverBig && t.album.coverBig.replace(/^https/, "http"),
                }));
        }

        return null;
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IMethodOptions = {}) {
        return await (await this.search([track.name, ...track.artists.map((a) => a.name)].join(","), source, {
            limit,
            playbackQuality,
        })).values();
    }
}
