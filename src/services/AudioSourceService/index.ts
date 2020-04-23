import * as dns from "dns";
import * as url from "url";

// @ts-ignore
import { simplify } from "hanzi-tools";

import * as schedule from "node-schedule";
import { compareTwoStrings, findBestMatch } from "string-similarity";

import RaceManager from "./RaceManager";

// @ts-ignore
import TrackListModel from "../../models/TrackListModel";

import IOptions from "./IServiceMethodOptions";

import Artist from "./Artist";
import List from "./List";
import PlaybackSource from "./PlaybackSource";
import Source from "./Source";
import Track from "./Track";
import TrackList from "./TrackList";

import { getConfig } from "./utils";

const config = getConfig();

interface IGetAlternativeTracksOptions extends IOptions {
    exceptedSourceIds?: string[];
    exceptedIds?: string[];
    similarityRange?: { high?: number, low?: number };
    exactMatch?: boolean;
    timeout?: number;
}

interface IGetStreamOptions {
    quality?: number;
    timeToWait?: number;
    alterTracks?: {
        track?: { name: string, artists: Array<{ name: string }> }|null;
        sourceIds?: string[];
        exceptedSourceIds?: string[];
        similarityRange?: { high?: number, low?: number };
        exactMatch?: boolean;
    };
}

const cleanText = (text: string, removeParen = false) => {
    const parenRegEx = /[(（](?:\S|\s)+?[)）]/g;
    const blankCharRegEx = /\s+/g;

    return simplify((removeParen ? text.replace(parenRegEx, "").replace(blankCharRegEx, "") : text).toLowerCase());
};

export default class AudioSourceService {
    public static QUEUE_MAX_SIZE = config.caching.queueMaxSize;

    public static getSources() {
        return Source.values().map((source) => ({
            icons: source.icons,
            id: source.id,
            name: source.name,
        }));
    }

    public cacheService: any;

    set locationService(locationService: any) {
        this.privateLocationService = locationService;
        this.raceManager.locationService = locationService;
    }

    set proxyPool(proxyPool: any) {
        this.privateProxyPool = proxyPool;

        Source.values().forEach((source) => {
            source.producers.forEach((producer) => {
                producer.proxyPool = proxyPool;
            });
        });

        this.raceManager.proxyPool = proxyPool;
    }

    private privateLocationService: any;
    private privateProxyPool: any = { getProxyList() { return null; } };
    private raceManager = new RaceManager();
    private trackCachingQueue = new Set();
    private cachingJobRunning = false;
    private scheduleJobRunning = false;

    constructor() {
        schedule.scheduleJob("0 0 0 * * ?", async () => {
            if (this.scheduleJobRunning) {
                return;
            }

            this.scheduleJobRunning = true;
            console.log("Audio source service scheduled job running."); // tslint:disable-line

            try {
                await this.cacheTrackLists();
            } catch (e) {
                // console.log(e);
            }

            try {
                await this.removeOutdatedCache();
            } catch (e) {
                // console.log(e);
            }

            this.scheduleJobRunning = false;
        });
    }

    public async getTrack(id: string, sourceId: string, {
        playbackQuality = 0,
        sourceRating,
        producerRating,
    }: IOptions = {}) {
        const source = Source.fromId(sourceId);

        if (!source) {
            return null;
        }

        const track = await source.getTrack(id, { playbackQuality, producerRating });

        if (!track) {
            return null;
        }

        this.addToCachingQueue(track);

        return {
            artists: track.artists.map((a) => ({ name: a.name })),
            duration: track.duration,
            id: track.id,
            name: track.name,
            picture: track.picture,
            source: track.source.id,

            playbackSources: track.playbackSources && track.playbackSources.map((p) => ({
                cached: p.cached,
                live: p.live,
                quality: p.quality,
                statical: p.statical,
                urls: p.urls,
            })),
        };
    }

    public async search(keywords: string, {
        sourceIds,
        limit = 20,
        sourceRating,
        producerRating,
        playbackQuality = 0,
    }: IOptions = {}) {
        const sources = ((ids) => {
            if (!ids || !ids.length) {
                return Source.values();
            }

            return ids.map((sourceId) => Source.fromId(sourceId));
        })(sourceIds);

        let err;

        const trackLists = await Promise.all((sources.filter((s) => s) as Source[]).map((source) => (async () => {
            try {
                return await source.search(keywords, {
                    limit,
                    playbackQuality,
                    producerRating,
                });
            } catch (e) {
                err = e;

                return new TrackList();
            }
        })()));

        const trackListLength = trackLists.reduce((total, trackList) => total + trackList.length, 0);

        limit = Math.min(limit, trackListLength);

        const trackPromises = [];
        const len = trackLists.length;

        loop1: for (let i = 0; trackPromises.length < limit; i++) {
            for (let j = 0; j < len; j++) {
                const trackList = trackLists[j];

                if (trackPromises.length >= limit) {
                    break loop1;
                }

                if (i < trackList.length) {
                    trackPromises.push(trackList.get(i));
                }
            }
        }

        const tracks = (await Promise.all(trackPromises)).filter((t) => t) as Track[];

        if (!tracks.length) {
            if (err) {
                throw err;
            }

            return [];
        }

        this.addToCachingQueue(tracks);

        const keywordsCleaned = cleanText(keywords);

        return findBestMatch(keywordsCleaned, tracks.map(({ name }) => cleanText(name))).ratings
            .map(({ rating }, i) => {
                const track = tracks[i];

                const artistsSimilarity = (() => {
                    if (!track.artists) {
                        return 0;
                    }

                    return track.artists
                        .map((a) => compareTwoStrings(cleanText(a.name), keywordsCleaned))
                        .reduce((total, artistRating) => total + artistRating, 0) / track.artists.length;
                })();

                return {
                    artists: track.artists.map((a) => ({ name: a.name, aliases: a.aliases })),
                    duration: track.duration,
                    id: track.id,
                    name: track.name,
                    picture: track.picture,
                    source: track.source.id,

                    playbackSources: track.playbackSources ? track.playbackSources.map((p) => ({
                        cached: p.cached,
                        live: p.live,
                        quality: p.quality,
                        statical: p.statical,
                        urls: p.urls,
                    })) : undefined,

                    similarity: Math.min(rating + artistsSimilarity, 1),
                };
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    public async getLists({ sourceIds, limit, offset, sourceRating, producerRating, noCache = false }: IOptions = {}) {
        if (!Array.isArray(sourceIds) && sourceIds) {
            const source = Source.fromId(sourceIds);

            if (!source) {
                return null;
            }

            if (!noCache) {
                try {
                    const docs = await TrackListModel.find({ sourceId: source.id }, "id name").exec();

                    if (!docs || !docs.length) {
                        throw new Error("No doc cached.");
                    }

                    return docs.map((doc: any) => ({
                        id: doc.id,
                        name: doc.name,
                    }));
                } catch (e) {
                    // console.log(e);
                }
            }

            const lists = await source.getLists({ limit, offset, producerRating });

            if (!lists) {
                return null;
            }

            (async () => {
                try {
                    await this.cacheTrackLists(lists);
                } catch (e) {
                    // console.log(e);
                }
            })();

            return lists.map((list) => ({
                id: list.id,
                name: list.name,
            }));
        }

        const sources = ((ids) => {
            if (!ids || !ids.length) {
                return Source.values();
            }

            return ids.map((sourceId) => Source.fromId(sourceId));
        })(sourceIds);

        return await Promise.all(sources.map(async (source) => {
            if (!source) {
                return null;
            }

            if (!noCache) {
                try {
                    const docs = await TrackListModel.find({ sourceId: source.id }, "id name").exec();

                    if (!docs || !docs.length) {
                        throw new Error("No doc cached.");
                    }

                    return docs.map((doc: any) => ({
                        id: doc.id,
                        name: doc.name,
                    }));
                } catch (e) {
                    // console.log(e);
                }
            }

            const lists = await source.getLists({ limit, offset, producerRating });

            if (!lists) {
                return null;
            }

            this.cacheTrackLists(lists);

            return lists.map((list) => ({
                id: list.id,
                name: list.name,
            }));
        }));
    }

    public async getList(id: string, sourceId: string, {
        playbackQuality = 0,
        limit,
        offset,
        sourceRating,
        producerRating,
        noCache = false,
    }: IOptions = {}) {
        const source = Source.fromId(sourceId);

        if (!source) {
            return null;
        }

        const tracks = await (async () => {
            if (!noCache) {
                try {
                    const doc = await TrackListModel.findOne({ id, sourceId }, "tracks").exec();

                    if (!doc || !doc.tracks || !doc.tracks.length) {
                        throw new Error("No track cached.");
                    }

                    return doc.tracks.map((track: any) => {
                        const { name, duration, artists, picture, playbackSources } = track;

                        return new Track(track.id, name, artists, source, {
                            duration,
                            picture,

                            playbackSources: (playbackSources && playbackSources.length
                                && playbackSources.map((p: any) => new PlaybackSource(p.urls, {
                                    cached: true,
                                    quality: p.quality,
                                    statical: p.statical,
                                }))) || undefined,
                        });
                    });
                } catch (e) {
                    // console.log(e);
                }
            }

            return await source.getList(id, { playbackQuality, limit, offset, producerRating });
        })();

        if (!tracks) {
            return null;
        }

        this.addToCachingQueue(tracks);

        return tracks.map((track: any) => ({
            artists: track.artists.map((a: Artist) => ({ name: a.name, aliases: a.aliases })),
            duration: track.duration,
            id: track.id,
            name: track.name,
            picture: track.picture,
            source: track.source.id,

            playbackSources: (track.playbackSources && track.playbackSources.map((p: any) => ({
                cached: p.cached,
                live: p.live,
                quality: p.quality,
                statical: p.statical,
                urls: p.urls,
            }))) || undefined,
        }));
    }

    public async getPlaybackSources(id: string, sourceId: string, {
        sourceRating,
        producerRating,
        playbackQuality = 0,
    }: IOptions = {}) {
        const source = Source.fromId(sourceId);

        if (source) {
            const playbackSources = await source.getPlaybackSources(id, { producerRating, playbackQuality });

            if (!playbackSources || !playbackSources.length) {
                return null;
            }

            return playbackSources.map((p) => ({
                cached: p.cached,
                live: p.live,
                quality: p.quality,
                statical: p.statical,
                urls: p.urls,
            }));
        } else {
            return null;
        }
    }

    public async getRecommend(track: { name: string, artists: string[] }|null, {
        sourceIds,
        playbackQuality = 0,
        sourceRating,
        producerRating,
        retrievePlaybackSource = false,
        withPlaybackSourceOnly = false,
    }: IOptions = {}): Promise<any> {
        const sources = ((ids) => {
            if (!ids || !ids.length) {
                return Source.values();
            }

            return (ids.map((sourceId) => Source.fromId(sourceId)).filter((s) => s) as Source[]);
        })(sourceIds);

        const abortController = new AbortController();

        if (!sourceRating) {
            let failCount = 0;
            let err: Error;

            const recommendedTrackPromise = Promise.race(sources.map(async (source) => {
                try {
                    const recommendedTracks = await (async (trackToGetRecommendsFor) => {
                        if (trackToGetRecommendsFor) {
                            const { name, artists } = trackToGetRecommendsFor;

                            return await source
                                .getRecommends(new Track("", name, artists.map((a) => new Artist(a)), source), {
                                    abortSignal: abortController.signal,
                                    playbackQuality,
                                    producerRating,
                                }) || null;
                        }

                        return await source.getRecommends(null, {
                            abortSignal: abortController.signal,
                            playbackQuality,
                            producerRating,
                        }) || null;
                    })(track);

                    if (recommendedTracks && recommendedTracks.length) {
                        recommendedTracks.sort(() => Math.random() - .5);

                        for (const recommendedTrack of recommendedTracks) {
                            if (!recommendedTrack) {
                                continue;
                            }

                            const { id, name, artists, duration, picture, playbackSources } = recommendedTrack;

                            const retrievedSources = await (async () => {
                                if  (playbackSources && playbackSources.length) {
                                    return playbackSources.map((p: PlaybackSource) => ({
                                        cached: p.cached,
                                        live: p.live,
                                        quality: p.quality,
                                        statical: p.statical,
                                        urls: p.urls,
                                    }));
                                }

                                if (retrievePlaybackSource) {
                                    try {
                                        return await this.getPlaybackSources(id, recommendedTrack.source.id, {
                                            playbackQuality,
                                        });
                                    } catch (e) {
                                        // console.log(e);
                                    }
                                }

                                return null;
                            })();

                            if (!withPlaybackSourceOnly || retrievedSources && retrievedSources.length) {
                                abortController.abort();

                                return {
                                    artists: artists.map((a) => ({ name: a.name, aliases: a.aliases })),
                                    duration,
                                    id,
                                    name,
                                    picture,
                                    playbackSources: retrievedSources || undefined,
                                    source: recommendedTrack.source.id,
                                };
                            }
                        }
                    }

                    failCount++;

                    if (failCount >= sources.length) {
                        if (err) {
                            throw err;
                        }

                        return null;
                    }

                    await recommendedTrackPromise;
                } catch (e) {
                    failCount++;

                    if (failCount >= sources.length) {
                        throw e;
                    }

                    err = e;

                    await recommendedTrackPromise;
                }
            }));

            if (await recommendedTrackPromise === null && track) {
                return await this.getRecommend(null, {
                    playbackQuality,
                    producerRating,
                    retrievePlaybackSource,
                    sourceIds,
                    sourceRating,
                    withPlaybackSourceOnly,
                });
            }

            return await recommendedTrackPromise;
        }

        sources.sort(() => Math.random() - .5);

        for (const source of sources) {
            try {
                const recommendedTracks = await (async (trackToGetRecommendsFor) => {
                    if (trackToGetRecommendsFor) {
                        const { name, artists } = trackToGetRecommendsFor;

                        return await source
                            .getRecommends(new Track("", name, artists.map((a) => new Artist(a)), source), {
                                abortSignal: abortController.signal,
                                playbackQuality,
                                producerRating,
                            }) || null;
                    }

                    return await source.getRecommends(null, {
                        abortSignal: abortController.signal,
                        playbackQuality,
                        producerRating,
                    }) || null;
                })(track);

                if (recommendedTracks && recommendedTracks.length) {
                    recommendedTracks.sort(() => Math.random() - .5);

                    for (const recommendedTrack of recommendedTracks) {
                        const { id, name, artists, duration, playbackSources, picture } = recommendedTrack;

                        const retrievedPlaybackSources = await (async () => {
                            if  (playbackSources && playbackSources.length) {
                                return playbackSources.map((p) => ({
                                    cached: p.cached,
                                    live: p.live,
                                    quality: p.quality,
                                    statical: p.statical,
                                    urls: p.urls,
                                }));
                            }

                            if (retrievePlaybackSource) {
                                try {
                                    return await this.getPlaybackSources(id, recommendedTrack.source.id, {
                                        playbackQuality,
                                    });
                                } catch (e) {
                                    // console.log(e);
                                }
                            }

                            return undefined;
                        })();

                        if (!withPlaybackSourceOnly || retrievedPlaybackSources && retrievedPlaybackSources.length) {
                            abortController.abort();

                            return {
                                artists: artists.map((a) => ({ name: a.name, aliases: a.aliases })),
                                duration,
                                id,
                                name,
                                picture,
                                playbackSources: retrievedPlaybackSources,
                                source: recommendedTrack.source.id,
                            };
                        }
                    }
                }
            } catch (e) {
                // console.log(e);
            }
        }

        return null;
    }

    public async getAlterTracks(name: string, artistNames: string[], {
        playbackQuality = 0,
        limit = 10,
        offset,
        sourceIds,
        exceptedSourceIds = [],
        exceptedIds = [],
        similarityRange,
        exactMatch = false,
        sourceRating,
        producerRating,
        retrievePlaybackSource = false,
        withPlaybackSourceOnly = false,
        timeout,
    }: IGetAlternativeTracksOptions = {}) {
        if (!name || !artistNames) {
            return null;
        }

        const sources = ((ids) => {
            if (!ids || !ids.length) {
                return Source.values();
            }

            return ids.map((sourceId) => Source.fromId(sourceId)).filter((s) => s) as Source[];
        })(sourceIds).filter((source) => !exceptedSourceIds.reduce((matched, e) => matched || source.id === e, false));

        let err;

        const tracks = (await Promise.all(sources.map(async (source) => {
            try {
                return await Promise.race([
                    source.getAlterTracks(new Track("", name, artistNames.map((a) => new Artist(a)), source), {
                        limit,
                        playbackQuality,
                        producerRating,
                    }),
                ].concat(timeout ? new Promise<null>((resolve, reject) => setTimeout(() => reject(new Error("Timeout fetching tracks.")), timeout)) : []));
            } catch (e) {
                // console.log(e);

                err = e;

                return null;
            }
        })))
            .flat()
            .filter((matchedTrack) => matchedTrack)
            .filter((matchedTrack) => !exceptedIds.includes(matchedTrack.id));

        if (!tracks.length) {
            if (err) {
                throw err;
            }

            return [];
        }

        const altTracks = (findBestMatch(cleanText(name, true), tracks.map((t) => cleanText(t.name, true))).ratings
            .map(({ rating, target }, i) => {
                const track = tracks[i];

                const similarity = (() => {
                    const artistsSimilarity = track.artists

                        .map((artist: Artist) =>
                            findBestMatch(cleanText(artist.name), artistNames.map((a) =>
                                cleanText(a))).bestMatch.rating)

                        .reduce((total: number, artistRating: number) => total + artistRating) / track.artists.length;

                    const actualSimilarity = rating * .6 + artistsSimilarity * .4;

                    const lowPriorityWords = [
                        "concert",
                        "cover",
                        "inst.",
                        "instrumental",
                        "karaoke",
                        "live",
                        "现场",
                        "伴奏",
                    ];

                    const lowPriorityPattern = `[(（](?:\\S|\\s)*(?:${lowPriorityWords.join("|")})(?:\\S|\\s)*[)）]`;

                    if (new RegExp(lowPriorityPattern).test(cleanText(track.name))) {
                        return Math.min(actualSimilarity, (() => {
                            if (similarityRange) {
                                if (similarityRange.low) {
                                    return similarityRange.low;
                                }

                                if (similarityRange.high) {
                                    return similarityRange.high * .5;
                                }
                            }

                            return .5;
                        })());
                    }

                    return actualSimilarity;
                })();

                if (exactMatch && similarity < 1) {
                    return null;
                }

                if (similarityRange) {
                    const notValid = (typeof similarityRange.high !== "undefined" && similarity > similarityRange.high)
                        || (typeof similarityRange.low !== "undefined" && similarity < similarityRange.low)
                        || (typeof similarityRange.high !== "undefined" && typeof similarityRange.low !== "undefined"
                            && +similarityRange.high < +similarityRange.low);

                    if (notValid) {
                        return null;
                    }
                }

                const playbackSources = (track.playbackSources && track.playbackSources.length && track.playbackSources)
                    || undefined;

                return {
                    artists: track.artists.map((a: Artist) => ({ name: a.name, aliases: a.aliases })),
                    duration: track.duration,
                    id: track.id,
                    name: track.name,
                    picture: track.picture,
                    source: track.source.id,

                    playbackSources: playbackSources && playbackSources.map((p: PlaybackSource) => ({
                        cached: p.cached,
                        live: p.live,
                        quality: p.quality,
                        statical: p.statical,
                        urls: p.urls,
                    })),

                    similarity,
                };
            })
            .filter((track) => track) as Array<{
                id: string,
                source: string,
                playbackSources: any,
                similarity: number,
            }>)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        if (retrievePlaybackSource) {
            await Promise.all(altTracks.map(async (track) => {
                if (!track.playbackSources) {
                    track.playbackSources = (await (async () => {
                        try {
                            return await this.getPlaybackSources(track.id, track.source, { playbackQuality });
                        } catch (e) {
                            // console.log(e);
                        }
                    })()) || undefined;
                }

                return track;
            }));
        }

        if (withPlaybackSourceOnly) {
            return altTracks.filter((altTrack) => altTrack.playbackSources && altTrack.playbackSources.length);
        }

        return altTracks;
    }

    public async getStream(id: string, sourceId: string, {
        quality = 0,
        timeToWait,
        alterTracks = {},
    }: IGetStreamOptions = {}) {
        const { sourceIds, exceptedSourceIds, similarityRange, exactMatch } = alterTracks;

        const { name, artistNames }: { name?: string, artistNames?: string[] } = await (async (track) => {
            if (!track) {
                track = await this.getTrack(id, sourceId);
            }

            if (!track) {
                return {};
            }

            return track;
        })(alterTracks.track);

        const altTracksPromises = (name && artistNames) ? AudioSourceService.getSources()
            .filter((source) => source.id !== sourceId)
            .filter((source) => {
                if (!sourceIds) {
                    return true;
                }

                return sourceIds.includes(source.id);
            })
            .filter((source) => {
                if (!exceptedSourceIds) {
                    return true;
                }

                return !exceptedSourceIds.includes(source.id);
            })
            .map((source) => this.getAlterTracks(name, artistNames, {
                exactMatch,
                playbackQuality: quality,
                similarityRange,
                sourceIds: [source.id],
            })) : [];

        const playbackSources = await this.getPlaybackSources(id, sourceId, { playbackQuality: quality });

        let raceEnded = false;

        const racePromise = this.raceManager.startRace();

        if (playbackSources) {
            for (const playbackSource of playbackSources) {
                this.raceManager.joinRace(playbackSource.urls,
                    timeToWait ? timeToWait * Math.abs(playbackSource.quality - quality) : 0);
            }
        }

        setTimeout(async () => {
            if (raceEnded === true) {
                return;
            }

            for (const altTracksPromise of altTracksPromises) {
                const altTracks = await altTracksPromise;

                if (!altTracks || !altTracks.length) {
                    continue;
                }

                for (const altTrack of altTracks) {
                    if (!altTrack.playbackSources || !altTrack.playbackSources.length) {
                        altTrack.playbackSources = this.getPlaybackSources(altTrack.id, altTrack.source, {
                            playbackQuality: quality,
                        });
                    }

                    for (const playbackSource of altTrack.playbackSources) {
                        this.raceManager.joinRace(playbackSource.urls,
                            timeToWait ? timeToWait * Math.abs(playbackSource.quality - quality) : 0);
                    }
                }

                this.raceManager.stopJoinRace();
            }
        }, timeToWait);

        if (!this.raceManager.racerNum) {
            return null;
        }

        const stream = await racePromise;

        raceEnded = true;

        return stream;
    }

    private addToCachingQueue(tracks: Track[]|Track) {
        if (this.trackCachingQueue.size >= AudioSourceService.QUEUE_MAX_SIZE) {
            return;
        }

        if (!Array.isArray(tracks)) {
            this.trackCachingQueue.add(tracks);
        } else {
            for (const track of tracks) {
                this.trackCachingQueue.add(track);
            }
        }

        this.runCachingJob();
    }

    private async runCachingJob() {
        if (this.cachingJobRunning) {
            return;
        }

        this.cachingJobRunning = true;

        while (true) {
            if (!this.trackCachingQueue.size) {
                break;
            }

            const track = this.trackCachingQueue.values().next().value;

            this.trackCachingQueue.delete(track);

            try {
                await this.cacheTrack(track);
            } catch (e) {
                // console.log(e);
            }

            await new Promise((resolve) => setTimeout(resolve, config.caching.coolDownTime));
        }

        this.cachingJobRunning = false;
    }

    private async cacheTrack(track: Track) {
        const streamUrls = (await (async () => {
            const playbackSources = await (async () => {
                if (track.playbackSources) {
                    return track.playbackSources;
                }

                return await this.getPlaybackSources(track.id, track.source.id);
            })();

            if (!playbackSources) {
                return [];
            }

            return playbackSources.filter((p) => !p.live).flatMap((p) => p.urls);
        })()).map((streamUrl) => {
            const fixedUrl = ((urlToFix) => {
                if (!/:/.test(urlToFix)) {
                    return "https://" + urlToFix;
                }

                return urlToFix;
            })(streamUrl.replace(/^\/+/, "").replace(/\/+$/, ""));

            return url.parse(fixedUrl);
        });

        for (const streamUrl of streamUrls) {
            if (this.cacheService.exists(streamUrl.href)) {
                return;
            }

            try {
                await this.cacheService.cache(streamUrl.href, await this.cacheService.sendRequest(streamUrl, "GET", {
                    timeout: config.caching.timeout,
                }), { transmissionRate: config.caching.transmissionRate });
            } catch (e) {
                // console.log(e);

                const proxies = await (async (urlToProxy) => {
                    const ip = await new Promise((resolve, reject) => {
                        if (!urlToProxy.host) {
                            return [];
                        }

                        dns.lookup(urlToProxy.host, (err, address) => {
                            if (err) {
                                reject(err);
                            }

                            resolve(address);
                        });
                    });

                    const location = await this.privateLocationService.getLocation(ip);

                    return this.privateProxyPool.getProxyList(location.areaCode);
                })(streamUrl);

                for (const proxy of proxies) {
                    try {
                        await this.cacheService.cache(streamUrl.href, await this.cacheService.sendRequest(streamUrl, "GET", {
                            proxy,
                            timeout: config.caching.timeout,
                        }), { transmissionRate: config.caching.transmissionRate });

                        break;
                    } catch (e) {
                        // console.log(e);
                    }
                }
            }
        }
    }

    private async cacheTrackLists(lists?: List[]) {
        if (lists && Array.isArray(lists) && lists[0] instanceof List) {
            for (const list of lists) {
                try {
                    const tracks = await this.getList(list.id, list.source.id, { noCache: true });

                    if (tracks) {
                        for (const track of tracks) {
                            if (!track.playbackSources || !track.playbackSources.length) {
                                try {
                                    track.playbackSources = await this.getPlaybackSources(track.id, track.source.id)
                                        || undefined;
                                } catch (e) {
                                    // console.log(e);
                                }
                            }

                            if (!track.playbackSources || !track.playbackSources.length) {
                                track.playbackSources = undefined;
                            }
                        }
                    }

                    try {
                        await TrackListModel.createOrUpdate({
                            id: list.id,
                            sourceId: list.source.id,
                        }, {
                            id: list.id,
                            name: list.name,
                            sourceId: list.source.id,
                            tracks,
                            updatedOn: new Date(),
                        });
                    } catch (e) {
                        // console.log(e);
                    }
                } catch (e) {
                    // console.log(e);
                }
            }

            return;
        }

        const sources = AudioSourceService.getSources();

        for (const source of sources) {
            try {
                const allLists = (await this.getLists({ sourceIds: [source.id], noCache: true }))[0];

                for (const list of allLists) {
                    try {
                        const tracks = await this.getList(list.id, source.id, { noCache: true });

                        if (tracks) {
                            for (const track of tracks) {
                                if (!track.playbackSources || !track.playbackSources.length) {
                                    try {
                                        track.playbackSources =
                                            await this.getPlaybackSources(track.id, track.source.id);
                                    } catch (e) {
                                        // console.log(e);
                                    }
                                }

                                if (!track.playbackSources || !track.playbackSources.length) {
                                    track.playbackSources = undefined;
                                }
                            }
                        }

                        try {
                            await TrackListModel.createOrUpdate({
                                id: list.id,
                                sourceId: source.id,
                            }, {
                                id: list.id,
                                name: list.name,
                                sourceId: source.id,
                                tracks,
                                updatedOn: new Date(),
                            });
                        } catch (e) {
                            // console.log(e);
                        }

                        await new Promise((resolve) => setTimeout(resolve, config.caching.coolDownTime));
                    } catch (e) {
                        // console.log(e);
                    }
                }
            } catch (e) {
                // console.log(e);
            }
        }
    }

    private async removeOutdatedCache() {
        try {
            const date = new Date();

            await TrackListModel.deleteMany({
                updatedOn: {
                    $lt: new Date(date.getTime() - config.caching.expiresAfter),
                },
            }).exec();
        } catch (e) {
            // console.log(e);
        }
    }
}
