// @ts-ignore
import * as SC from "node-soundcloud";

import IMethodOptions from "../IMethodOptions";

import Artist from "../Artist";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import { getConfig } from "../utils";

const config = getConfig();

SC.get = (() => {
    const get = SC.get;

    return (path: any, params: any) => new Promise((resolve, reject) => {
        try {
            get.call(SC, path, params, (err: any, data: any) => {
                if (err) {
                    return reject(err);
                }

                resolve(data);
            });
        } catch (e) {
            reject(e);
        }
    });
})();

SC.init({ id: config.producers.nodeSoundCloud.clientId });

class NodeSoundCloudTrackList extends TrackList<any> {
    private readonly source: Source;
    private readonly playbackQuality: number;

    constructor(tracks: Track[], source: Source, { playbackQuality = 0 } = {}) {
        super(tracks);

        this.source = source;
        this.playbackQuality = playbackQuality;
    }

    public async get(index: number): Promise<Track|null>;
    public async get(): Promise<Track[]|null>;
    public async get(index?: number) {
        if (typeof index === "undefined") {
            return this.tracks.map((track) => {
                if (!track) {
                    return null;
                }

                return new Track(String(track.id), track.title, [new Artist(track.user.username)], this.source, {
                    duration: +track.duration,
                    picture: track.artwork_url,
                });
            });
        }

        const matchedTrack = this.tracks[index];

        if (!matchedTrack) {
            return null;
        }

        return new Track(String(matchedTrack.id), matchedTrack.title, [
            new Artist(matchedTrack.user.username),
        ], this.source, {
            duration: +matchedTrack.duration,
            picture: matchedTrack.artwork_url,
        });
    }
}

export default class NodeSoundCloudProducer extends Producer { // tslint:disable-line
    public static readonly sources = [Source.soundCloud];

    public async search(keywords: string, source: Source, { limit, playbackQuality = 0 }: IMethodOptions = {}) {
        const tracks = (await (async () => {
            try {
                return await SC.get("/tracks", {
                    limit,
                    q: keywords,
                });
            } catch (e) {
                throw e;
            }
        })()) || [];

        return new NodeSoundCloudTrackList(tracks, source);
    }

    public async getPlaybackSources(id: string, source: Source, { playbackQuality = 0 } = {}) {
        try {
            const tracks = await SC.get("/tracks", { ids: String(id) });

            return tracks && tracks
                .map((track: any) => track && track.stream_url && `${track.stream_url}?client_id=${SC.clientId}`)
                .filter((url: string) => url)
                .map((url: string) => new PlaybackSource([url], { quality: 0 }));
        } catch (e) {
            return [];
        }
    }

    public async getRecommends(source: Source, track: Track, { playbackQuality = 0, abortSignal }: IMethodOptions) {
        const tracks = await (async () => {
            if (track) {
                const { name, artists } = track;

                if (name) {
                    const matchedTrack = (await SC.get("/tracks", {
                        limit: 1,
                        q: [name, ...artists.map((artist) => artist.name)].join(","),
                    }))[0];

                    if (matchedTrack) {
                        const similarTracks = await SC.get("/tracks", { tags: matchedTrack.tag_list.replace(/\s*"(?:.|\n)*"/g, "").replace(/^\s*/g, "").split(/\s+/).join(",") });

                        if (similarTracks && similarTracks.length > 1) {
                            return similarTracks.slice(1);
                        }
                    }
                }
            }

            return null;
        })();

        if (!tracks || !tracks.length) {
            return await super.getRecommends(source, track, { playbackQuality, abortSignal });
        }

        const trackList = new NodeSoundCloudTrackList(tracks, source, { playbackQuality });

        return await trackList.get();
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IMethodOptions = {}) {
        return await (await this.search([
            track.name,
            ...track.artists.map((artist) => artist.name),
        ].join(","), source, { playbackQuality, limit })).values();
    }

    public async getTrack(id: string, source: Source, { playbackQuality = 0 } = {}) {
        const track = await (async () => {
            try {
                return (await SC.get("/tracks", { ids: String(id) }))[0];
            } catch (e) {
                // console.log(e);

                throw e;
            }
        })();

        if (track) {
            return new Track(String(track.id), track.title, [new Artist(track.user.username)], source, {
                duration: track.duration,
                picture: track.artwork_url || undefined,
                playbackSources: track.stream_url ?
                    [new PlaybackSource([`${track.stream_url}?client_id=${SC.clientId}`], { quality: 0 })] : undefined,
            });
        }

        return null;
    }
}
