import IMethodOptions from "../IMethodOptions";

import Artist from "../Artist";
import Instance from "../Instance";
import List from "../List";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import Hearthis from "../../../libraries/audioSource/Hearthis";

import { getConfig } from "../utils";

const config = getConfig();

class HearthisTrackList extends TrackList<any> {
    private readonly source: Source;
    private readonly playbackQuality: number;

    constructor(tracks: Track[], source: Source, { playbackQuality = 0 } = {}) {
        super(tracks);

        this.source = source;
        this.playbackQuality = playbackQuality;
    }

    public async get(index: number) {
        const track = this.tracks[index];

        if (!track) {
            return null;
        }

        return new Track(String(track.id), track.title, [new Artist(track.user.username)], this.source, {
            duration: +track.duration * 1000,
            picture: track.artwork_url,
            playbackSources: [new PlaybackSource([track.stream_url])],
        });
    }
}

export default class HearthisProducer extends Producer { // tslint:disable-line
    public static readonly sources = [Source.hearthis];

    public static readonly instances = config.producers.hearthis.instances
        .map((i: any) => new Instance(i.host, i.port, i.protocol));

    private static lists = new Map([
        [Source.hearthis, [
            { id: "popular", name: "Popular" },
            { id: "new", name: "New" },
            ]],
    ]);

    private readonly hearthis: Hearthis;

    constructor(host?: string, port?: number, protocol?: string) {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();
        this.hearthis = new Hearthis(host, port, protocol);
    }

    public async search(keywords: string, source: Source, { limit, playbackQuality = 0 }: IMethodOptions = {}) {
        const tracks = (await (async () => {
            try {
                return await this.hearthis.search(keywords, { count: limit });
            } catch (e) {
                if (e.message === "limit reached") {
                    return null;
                }

                throw e;
            }
        })()) || [];

        return new HearthisTrackList(tracks, source, { playbackQuality });
    }

    public async getPlaybackSources(id: string, source: Source, { playbackQuality = 0 } = {}) {
        try {
            const url = (await this.hearthis.getTrack(id)).stream_url;

            return typeof url === "string" ? [new PlaybackSource([url.replace(/^https/, "http")], { quality: 0 })] : [];
        } catch (e) {
            return [];
        }
    }

    public async getLists(source: Source) {
        const listNames = HearthisProducer.lists.get(source);

        if (!listNames) {
            throw new Error("No list existing.");
        }

        return listNames.map(({ id, name }) => new List(id, name, source));
    }

    public async getList(id: string, source: Source, { playbackQuality, limit, offset }: IMethodOptions = {}) {
        const tracks = await (async () => {
            try {
                return (await this.hearthis.getFeed(id)) || null;
            } catch (e) {
                throw e;
            }
        })();

        if (tracks) {
            return new HearthisTrackList(tracks, source, { playbackQuality }).values();
        }

        return null;
    }

    public async getAlterTracks(track: Track, source: Source, { playbackQuality = 0, limit }: IMethodOptions = {}) {
        return (await this.search([
            track.name,
            ...track.artists.map((artist) => artist.name),
        ].join(","), source, { playbackQuality, limit })).values();
    }

    public async getTrack(id: string, source: Source, { playbackQuality = 0 } = {}) {
        const track = await (async () => {
            try {
                return await this.hearthis.getTrack(id);
            } catch (e) {
                // console.log(e);

                throw e;
            }
        })();

        if (track) {
            return new Track(String(track.id), track.title, [new Artist(track.user.username)], source, {
                duration: +track.duration * 1000,
                picture: track.artwork_url,
                playbackSources: typeof track.stream_url === "string" ? [new PlaybackSource([track.stream_url.replace(/^https/, "http")], { quality: 0 })] : undefined,
            });
        }

        return null;
    }
}
