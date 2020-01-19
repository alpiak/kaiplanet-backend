import MusicInterface from "../../../libraries/audioSource/MusicInterface";

import IOptions from "../IMethodOptions";

import Artist from "../Artist";
import Instance from "../Instance";
import List from "../List";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import { getConfig } from "../utils";

const config = getConfig();

export default class MusicInterfaceProducer extends Producer {
    public static readonly sources = [Source.qq];

    public static readonly instances = config.producers.musicInterface.instances
        .map((i: any) => new Instance(i.host, i.port, i.protocol));

    private readonly musicInterface: MusicInterface;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();
        this.musicInterface = new MusicInterface(host, port, protocol);
    }

    public async search(keywords: string, source: Source, { limit, playbackQuality = 0 }: IOptions = {}) {
        const tracks = (await (async () => {
            try {
                return await this.musicInterface.search(keywords, 1, limit);
            } catch (e) {
                throw e;
            }
        })()).songList.filter((songData: any) => songData.songMid) || [];

        const getPicture = (track: Track) => this.getPicture(track);

        return new class extends TrackList<any> { // tslint:disable-line
            public async get(index: number) {
                const matchedTrack = this.tracks[index];

                if (!matchedTrack) {
                    return null;
                }

                const picture = await (async (track) => {
                    try {
                        return await getPicture(track);
                    } catch (e) {
                        return null;
                    }
                })(matchedTrack);

                return new Track(matchedTrack.songMid, matchedTrack.songName,
                    matchedTrack.singer.map((s: any) => new Artist(s.singerName)), source, { picture });
            }
        }(tracks);
    }

    public async getPlaybackSources(id: string, source: Source, { playbackQuality = 0 } = {}) {
        try {
            return (await this.musicInterface.getSongUrllist([id]))
                .filter((url: string) => url)
                .filter((url: string) => url !== "http://isure.stream.qqmusic.qq.com//")
                .map((url: string) => new PlaybackSource([url], { quality: 0 }));
        } catch (e) {
            return [];
        }
    }

    public async getRecommends(source: Source, track: Track, { playbackQuality = 0, abortSignal }: IOptions = {}) {
        if (!track) {
            const tracks = await (async () => {
                const lists = await (() => {
                    try {
                        return this.musicInterface.getToplists({ abortSignal });
                    } catch (e) {
                        throw e;
                    }
                })();

                if (lists && lists.length) {
                    const randomList = lists[Math.floor(lists.length * Math.random())];

                    try {
                        return (await this.musicInterface.getSongList(randomList.id, { abortSignal })) || null;
                    } catch (e) {
                        throw e;
                    }
                }

                return null;
            })();

            if (!tracks || !tracks.length) {
                return await super.getRecommends(source, track, { playbackQuality, abortSignal });
            }

            const randomTrack = tracks[Math.floor(tracks.length * Math.random())];

            const picture = await (async () => {
                try {
                    return await this.getPicture(randomTrack);
                } catch (e) {
                    return null;
                }
            })();

            return [new Track(randomTrack.songMid, randomTrack.songName,
                randomTrack.singer.map((s: any) => new Artist(s.singerName)), source, { picture })];
        }

        return await super.getRecommends(source, track, { playbackQuality, abortSignal });
    }

    public async getLists(source: Source) {
        return (await this.musicInterface.getToplists()).map((list: any) => new List(list.id, list.title, source));
    }

    public async getList(id: string, source: Source, {
        playbackQuality,
        limit,
        offset,
    }: IOptions = {}): Promise<Track[]|null> {
        const tracks = await (async () => {
            try {
                return (await this.musicInterface.getSongList(id)) || null;
            } catch (e) {
                throw e;
            }
        })();

        if (tracks) {
            return await Promise.all(tracks.map(async (t: any) =>
                new Track(t.songMid, t.songName, t.singer.map((s: any) => new Artist(s.singerName)), source, {
                    picture: await this.getPicture(t),
                })) as Array<Promise<Track>>);
        }

        return null;
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IOptions = {}) {
        return (await this.search([
            track.name,
            ...track.artists.map((artist) => artist.name),
        ].join(","), source, { playbackQuality, limit })).values();
    }

    private async getPicture(track: any) {
        try {
            const singerMid = track.singer[0] && track.singer[0].singerMid;

            return (await this.musicInterface.getAlbumImg(track.albumMid, singerMid)).albumImgUrl;
        } catch (e) {
            throw e;
        }
    }
}
