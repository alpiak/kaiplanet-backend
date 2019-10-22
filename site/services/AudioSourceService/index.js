const url = require("url");
const dns = require("dns");

const schedule = require("node-schedule");
const stringSimilarity = require("string-similarity");

const TrackListModel = require("../../models/TrackListModel");

module.exports = (env = "development") => {
    const config = require(`./config/${env}`);

    const Artist = require("./Artist")({ config });
    const Track = require("./Track")({ config });
    const TrackList = require("./TrackList")();
    const List = require("./List")({ Track, config });
    const Source = require("./Source")({ TrackList, config });
    const Producer = require("./producers/Producer")({ TrackList });

    const KaiPlanetProducer = require("./producers/KaiPlanetProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const NeteaseCloudMusicApiProducer = require("./producers/NeteaseCloudMusicApiProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const MusicInterfaceProducer = require("./producers/MusicInterfaceProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const MusicApiProducer = require("./producers/MusicApiProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const NodeSoundCloudProducer = require("./producers/NodeSoundCloudProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const HearthisProducer = require("./producers/HearthisProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const KugouMusicApiProducer = require("./producers/KugouMusicApiProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const KuGouMobileProducer = require("./producers/KuGouMobileProducer")({ Artist, Track, List, Source, Producer, config });
    const KuGouMobileCDNProducer = require("./producers/KuGouMobileCDNProducer")({ Artist, Track, TrackList, Source, Producer, config });

    return class AudioSourceService {
        static QUEUE_MAX_SIZE = config.caching.queueMaxSize;
        static Producers = [KaiPlanetProducer, NeteaseCloudMusicApiProducer, MusicInterfaceProducer, KugouMusicApiProducer, MusicApiProducer, KuGouMobileProducer, NodeSoundCloudProducer, HearthisProducer, KuGouMobileCDNProducer];

        static getSources() {
            return Source.values().map((source) => ({
                id: source.id,
                name: source.name,
                icons: source.icons,
            }));
        }

        set cacheService(cacheService) {
            this._cacheService = cacheService;
        }

        set locationService(locationService) {
            this._locationService = locationService;
        }

        set proxyPool(proxyPool) {
            this._proxyPool = proxyPool;

            Source.values().forEach((source) => {
                source.producers.forEach((producer) => {
                    producer.proxyPool = proxyPool;
                });
            });
        }

        _cacheService;
        _locationService;
        _proxyPool = { getProxyList() { return null; } };
        _trackCachingQueue = new Set();
        _cachingJobRunning = false;
        _scheduleJobRunning = false;

        constructor() {
            AudioSourceService.Producers.forEach((Producer) => {
                if (Producer.instances && Producer.instances.length) {
                    return Producer.instances.forEach((instance) => {
                        const producer = new Producer(instance.host, instance.port, instance.protocol);

                        Producer.sources.forEach((source) => {
                            source.producers.push(producer);
                        });
                    });
                }

                const producer = new Producer();

                Producer.sources.forEach((source) => {
                    source.producers.push(producer);
                });
            });

            schedule.scheduleJob("0 0 0 * * ?", async () => {
                if (this._scheduleJobRunning) {
                    return;
                }

                this._scheduleJobRunning = true;

                try {
                    await this._cacheTrackLists();
                    await this._removeOutdatedCache();
                } catch (e) {
                    console.log(e);
                }

                this._scheduleJobRunning = false;
            });
        }

        async getTrack(id, sourceId, { playbackQuality = 0, producerRating } = {}) {
            const track = await Source.fromId(sourceId).getTrack(id, { playbackQuality, producerRating });

            if (!track) {
                return null;
            }

            this._addToCachingQueue(track);

            return {
                id: track.id,
                name: track.name,
                duration: track.duration,
                artists: track.artists.map(artist => ({name: artist.name})),
                picture: track.picture,
                source: track.source.id,

                playbackSources: track.playbackSources && track.playbackSources.map((playbackSource) => ({
                    urls: playbackSource.urls,
                    quality: playbackSource.quality,
                })),
            };
        }

        async search(keywords, { sourceIds, limit = 20, sourceRating, producerRating, playbackQuality = 0 } = {}) {
            const sources = ((sourceIds) => {
                if (!sourceIds || !sourceIds.length) {
                    return Source.values();
                }

                return sourceIds.map((sourceId) => Source.fromId(sourceId));
            })(sourceIds);

            const trackLists = await Promise.all(sources.map((source) => (async () => {
                try {
                    return await source.search(keywords, {
                        limit,
                        producerRating,
                        playbackQuality,
                    });
                } catch {
                    return new TrackList();
                }
            })()));

            const trackListLength = trackLists.reduce((total, trackList) => total + trackList.length, 0);

            limit = Math.min(limit, trackListLength);

            const trackPromises = [];
            const len = trackLists.length;

            loop1:for (let i = 0; trackPromises.length < limit; i++) {
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

            const tracks = await Promise.all(trackPromises);

            if (!tracks.length) {
                return [];
            }

            this._addToCachingQueue(tracks);

            return stringSimilarity.findBestMatch(keywords, tracks.map(({name}) => name)).ratings
                .map(({ rating }, i) => {
                    const track = tracks[i];

                    const artistsSimilarity = track.artists
                        .map((artist) => stringSimilarity.compareTwoStrings(artist.name, keywords))
                        .reduce((total, rating) => total + rating, 0) / track.artists.length;

                    return {
                        id: track.id,
                        name: track.name,
                        duration: track.duration,
                        artists: track.artists.map(artist => ({name: artist.name})),
                        picture: track.picture,
                        source: track.source.id,

                        playbackSources: track.playbackSources && track.playbackSources.map((playbackSource) => ({
                            urls: playbackSource.urls,
                            quality: playbackSource.quality,
                        })),

                        similarity: Math.min(rating + artistsSimilarity, 1),
                    };
                })
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        }

        async getLists(sourceIds, { limit, offset, sourceRating, producerRating } = {}) {
            if (!Array.isArray(sourceIds) && sourceIds) {
                const source = Source.fromId(sourceIds);

                if (!source) {
                    return null;
                }

                try {
                    const docs = await TrackListModel.find({ sourceId: source.id }, "id name").exec();

                    if (!docs || !docs.length) {
                        throw new Error("No doc cached.");
                    }

                    return docs.map((doc) => ({
                        id: doc.id,
                        name: doc.name,
                    }));
                } catch (e) {
                    console.log(e);

                    const lists = await source.getLists({ limit, offset, producerRating });

                    if (!lists) {
                        return null;
                    }

                    (async () => {
                        try {
                            await this._cacheTrackLists(lists);
                        } catch (e) {
                            console.log(e);
                        }
                    })();

                    return lists.map((list) => ({
                        id: list.id,
                        name: list.name,
                    }));
                }
            }

            const sources = ((sourceIds) => {
                if (!sourceIds || !sourceIds.length) {
                    return Source.values();
                }

                return sourceIds.map((sourceId) => Source.fromId(sourceId));
            })(sourceIds);

            return await Promise.all(sources.map(async (source) => {
                    if (!source) {
                        return null;
                    }

                    try {
                        const docs = await TrackListModel.find({ sourceId: source.id }, "id name").exec();

                        if (!docs || !docs.length) {
                            throw new Error("No doc cached.");
                        }

                        return docs.map((doc) => ({
                            id: doc.id,
                            name: doc.name,
                        }));
                    } catch (e) {
                        console.log(e);

                        const lists = await source.getLists({ limit, offset, producerRating });

                        if (!lists) {
                            return null;
                        }

                        this._cacheTrackLists(lists);

                        return lists.map((list) => ({
                            id: list.id,
                            name: list.name,
                        }));
                    }
                }));
        };

        async getList(id, sourceId, { playbackQuality = 0, limit, offset, sourceRating, producerRating } = {}) {
            const source = Source.fromId(sourceId);

            const tracks = await (async () => {
                try {
                    const doc = await TrackListModel.findOne({ id, sourceId }, "tracks").exec();

                    if (!doc || !doc.length) {
                        throw new Error("No doc cached.");
                    }

                    return doc.tracks.map(({ id, name, duration, artists, picture, playbackSources }) => new Track(id, name, duration, artists, picture, source, playbackSources));
                } catch (e) {
                    console.log(e);

                    return await source.getList(id, { playbackQuality, limit, offset, producerRating });
                }
            })();

            if (!tracks) {
                return null;
            }

            this._addToCachingQueue(tracks);

            return tracks.map((track) => ({
                id: track.id,
                name: track.name,
                duration: track.duration,
                artists: track.artists.map(artist => ({name: artist.name})),
                picture: track.picture,
                source: track.source.id,

                playbackSources: track.playbackSources && track.playbackSources.map((playbackSource) => ({
                    urls: playbackSource.urls,
                    quality: playbackSource.quality,
                })),
            }));
        }

        async getPlaybackSources(id, sourceId, { sourceRating, producerRating, playbackQuality = 0 } = {}) {
            const source = Source.fromId(sourceId);

            if (source) {
                return (await source.getPlaybackSources(id, { producerRating, playbackQuality })).map((playbackSource) => ({
                    urls: playbackSource.urls,
                    quality: playbackSource.quality,
                }));
            } else {
                return null;
            }
        }

        async getRecommend(track, sourceIds, { playbackQuality = 0, sourceRating, producerRating } = {}) {
            const sources = ((sourceIds) => {
                if (!sourceIds || !sourceIds.length) {
                    return Source.values();
                }

                return sourceIds.map((sourceId) => Source.fromId(sourceId));
            })(sourceIds);

            if (!sourceRating) {
                let failCount = 0;
                let err;

                const recommendedTrackPromise = Promise.race(sources.map(async (source) => {
                    try {
                        const recommendedTrack = await (async (track) => {
                            if (track) {
                                const { name, artists } = track;

                                return await source.getRecommend(new Track(undefined, name, undefined, artists.map(artist => new Artist(artist))), { playbackQuality, producerRating }) || null;
                            }

                            return await source.getRecommend(null, { playbackQuality, producerRating }) || null;
                        })(track);

                        if (recommendedTrack) {
                            return {
                                id: recommendedTrack.id,
                                name: recommendedTrack.name,
                                duration: recommendedTrack.duration,
                                artists: recommendedTrack.artists.map(artist => ({name: artist.name})),
                                picture: recommendedTrack.picture,
                                source: recommendedTrack.source.id,

                                playbackSources: recommendedTrack.playbackSources && recommendedTrack.playbackSources.map((playbackSource) => ({
                                    urls: playbackSource.urls,
                                    quality: playbackSource.quality,
                                })),
                            };
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

                return await recommendedTrackPromise;
            }

            sources.sort(() => Math.random() - .5);

            for (const source of sources) {
                try {
                    const recommendedTrack = await (async (track) => {
                        if (track) {
                            const { name, artists } = track;

                            return await source.getRecommend(new Track(undefined, name, undefined, artists.map(artist => new Artist(artist))), { playbackQuality, producerRating }) || null;
                        }

                        return await source.getRecommend(null, { playbackQuality, producerRating }) || null;
                    })(track);

                    if (recommendedTrack) {
                        return {
                            id: recommendedTrack.id,
                            name: recommendedTrack.name,
                            duration: recommendedTrack.duration,
                            artists: recommendedTrack.artists.map(artist => ({name: artist.name})),
                            picture: recommendedTrack.picture,
                            source: recommendedTrack.source.id,

                            playbackSources: track.playbackSources && track.playbackSources.map((playbackSource) => ({
                                urls: playbackSource.urls,
                                quality: playbackSource.quality,
                            })),
                        };
                    }
                } catch (e) {
                    console.log(e);
                }
            }

            return null;
        }

        async getAlternativeTracks(name, artistNames, { playbackQuality = 0, limit = 10, offset, sourceIds, exceptedSourceIds = [], similarityRange, exactMatch = false, sourceRating, producerRating } = {}) {
            const sources = ((sourceIds) => {
                if (!sourceIds || !sourceIds.length) {
                    return Source.values();
                }

                return sourceIds.map((sourceId) => Source.fromId(sourceId));
            })(sourceIds).filter((source) => !exceptedSourceIds.reduce((matched, exceptedSourceId) => matched || source.id === exceptedSourceId, false));

            const tracks = (await Promise.all(sources.map(async (source) => {
                try {
                    return await source.getAlternativeTracks(new Track(undefined, name, undefined, artistNames.map(artistName => new Artist(artistName))), {
                        playbackQuality,
                        limit,
                        producerRating,
                    });
                } catch (e) {
                    console.log(e);

                    return null;
                }
            })))
                .filter((matchedTracks) => matchedTracks)
                .flat();

            if (!tracks.length) {
                return [];
            }

            return stringSimilarity.findBestMatch(name, tracks.map(({name}) => name)).ratings
                .map(({ rating }, i) => {
                    const track = tracks[i];

                    const artistsSimilarity = track.artists
                        .map((artist) => stringSimilarity.findBestMatch(artist.name, artistNames).bestMatch.rating)
                        .reduce((total, rating) => total + rating, 0) / track.artists.length;

                    const similarity = rating * .5 + artistsSimilarity * .5;

                    if (exactMatch && similarity < 1) {
                        return null;
                    }

                    const similarityRangeValid = similarityRange
                        && typeof similarityRange.high !== "undefined"
                        && typeof similarityRange.low !== "undefined"
                        && +similarityRange.high >= +similarityRange.low;

                    if (similarityRangeValid && similarity > similarityRange.high || similarity < similarityRange.low) {
                        return null;
                    }

                    return {
                        id: track.id,
                        name: track.name,
                        duration: track.duration,
                        artists: track.artists.map(artist => ({name: artist.name})),
                        picture: track.picture,
                        source: track.source.id,

                        playbackSources: track.playbackSources && track.playbackSources.map((playbackSource) => ({
                            urls: playbackSource.urls,
                            quality: playbackSource.quality,
                        })),

                        similarity,
                    };
                })
                .filter((track) => track)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        }

        _addToCachingQueue(tracks) {
            if (this._trackCachingQueue.size >= AudioSourceService.QUEUE_MAX_SIZE) {
                return;
            }

            if (!Array.isArray(tracks)) {
                this._trackCachingQueue.add(tracks);
            } else {
                for (const track of tracks) {
                    this._trackCachingQueue.add(track);
                }
            }

            this._runCachingJob();
        }

        async _runCachingJob() {
            if (this._cachingJobRunning) {
                return;
            }

            this._cachingJobRunning = true;

            while (true) {
                if (!this._trackCachingQueue.size) {
                    break;
                }

                const track = this._trackCachingQueue.values().next().value;

                this._trackCachingQueue.delete(track);

                try {
                    await this._cacheTrack(track);
                } catch (e) {
                    console.log(e);
                }

                await new Promise((resolve) => setTimeout(resolve, config.caching.coolDownTime));
            }

            this._cachingJobRunning = false;
        }

        async _cacheTrack(track) {
            const streamUrls = (await (async () => {
                if (track.playbackSources) {
                   return track.playbackSources;
                }

                return (await this.getPlaybackSources(track.id, track.source.id))
                    .map((playbackSource) => playbackSource.urls)
                    .flat();
            })()).map((streamUrl) => {
                const fixedUrl = ((url) => {
                    if (!/:/.test(url)) {
                        return 'https://' + url;
                    }

                    return url;
                })(streamUrl.replace(/^\/+/, '').replace(/\/+$/, ''));

                return url.parse(fixedUrl);
            });

            for (const streamUrl of streamUrls) {
                if (this._cacheService.exists(streamUrl.href)) {
                    return;
                }

                try {
                    await this._cacheService.cache(streamUrl.href, await this._cacheService.sendRequest(streamUrl, "GET", { timeout: config.caching.timeout }));
                } catch (e) {
                    console.log(e);

                    const proxies = await (async (url) => {
                        const ip = await new Promise((resolve, reject) => {
                            dns.lookup(url.host, (err, address) => {
                                if (err) {
                                    reject(err);
                                }

                                resolve(address);
                            });
                        });

                        const location = await this._locationService.getLocation(ip);

                        return this._proxyPool.getProxyList(location.areaCode);
                    })(streamUrl);

                    for (const proxy of proxies) {
                        try {
                            await this._cacheService.cache(streamUrl.href, await this._cacheService.sendRequest(streamUrl, "GET", {
                                proxy,
                                timeout: config.caching.timeout,
                            }));

                            break;
                        } catch (e) {
                            console.log(e);
                        }
                    }
                }
            }
        }

        async _cacheTrackLists(lists) {
            if (lists && Array.isArray(lists) && lists[0] instanceof List) {
                for (const list of lists) {
                    const tracks = await this.getList(list.id, list.source.id);

                    try {
                        await TrackListModel.createOrUpdate({
                            id: list.id,
                            sourceId: list.source.id,
                        }, {
                            id: list.id,
                            sourceId: list.source.id,
                            name: list.name,
                            tracks: tracks,
                            updatedOn: new Date(),
                        });
                    } catch (e) {
                        console.log(e);
                    }
                }

                return;
            }

            const sources = AudioSourceService.getSources();

            for (const source of sources) {
                const lists = await this.getLists(source.id);

                for (const list of lists) {
                    const tracks = await this.getList(list.id, source.id);

                    try {
                        await TrackListModel.createOrUpdate({
                            id: list.id,
                            sourceId: source.id,
                        }, {
                            id: list.id,
                            sourceId: source.id,
                            name: list.name,
                            tracks: tracks,
                            updatedOn: new Date(),
                        });
                    } catch (e) {
                        console.log(e);
                    }

                    await new Promise((resolve) => setTimeout(resolve, config.caching.coolDownTime));
                }
            }
        }

        async _removeOutdatedCache() {
            try {
                const date = new Date();

                await TrackListModel.deleteMany({
                    updatedOn: {
                        $gte: new Date(date.getTime() - config.caching.expiresAfter),
                        $lt: date,
                    }
                }).exec();
            } catch (e) {
                console.log(e);
            }
        }
    }
};
