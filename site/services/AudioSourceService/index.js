const stringSimilarity = require('string-similarity');

module.exports = (env = "development") => {
    const config = require(`./config/${env}`);

    const Artist = require("./Artist")({ config });
    const Track = require("./Track")({ config });
    const TrackList = require("./TrackList")({ config });
    const List = require("./List")({ Track, config });
    const Source = require("./Source")();
    const Producer = require("./producers/Producer")({ TrackList });

    const KaiPlanetProducer = require("./producers/KaiPlanetProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const NeteaseCloudMusicApiProducer = require("./producers/NeteaseCloudMusicApiProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const MusicInterfaceProducer = require("./producers/MusicInterfaceProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const MusicApiProducer = require("./producers/MusicApiProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const NodeSoundCloudProducer = require("./producers/NodeSoundCloudProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const HearthisProducer = require("./producers/HearthisProducer")({ Artist, Track, TrackList, List, Source, Producer, config });
    const KugouMusicApiProducer = require("./producers/KugouMusicApiProducer")({ Artist, Track, TrackList, List, Source, Producer, config });

    return class AudioSourceService {
        static Producers = [KaiPlanetProducer, NeteaseCloudMusicApiProducer, MusicInterfaceProducer, KugouMusicApiProducer, MusicApiProducer, NodeSoundCloudProducer, HearthisProducer];

        static getSources() {
            return Source.values().map((source) => ({
                id: source.id,
                name: source.name
            }));
        }

        set proxyPool(proxyPool) {
            this._proxyPool = proxyPool;

            Source.values().forEach((source) => {
                source.producers.forEach((producer) => {
                    producer.proxyPool = proxyPool;
                });
            });
        }

        _proxyPool = { getProxyList() { return null; } };

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
        }

        async search(keywords, { sourceIds, limit = 20, sourceRating, producerRating } = {}) {
            const sources = ((sourceIds) => {
                if (!sourceIds || !sourceIds.length) {
                    return Source.values();
                }

                return sourceIds.map((sourceId) => Source.fromId(sourceId));
            })(sourceIds);

            const trackLists = await Promise.all(sources.map((source) => source.search(keywords, {
                limit,
                producerRating
            })));
            const trackListLength = trackLists.reduce((total, trackList) => total + trackList.length, 0);

            limit = Math.min(limit, trackListLength);

            const trackPromises = [];
            const len = trackLists.length;

            loop1:for (let i = 0; trackPromises.length < limit * len; i++) {
                for (let j = 0; j < len; j++) {
                    const trackList = trackLists[j];

                    if (trackPromises.length >= limit * len) {
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

            return stringSimilarity.findBestMatch(keywords, tracks.map(({name}) => name)).ratings
                .map(({rating}, i) => {
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
                        streamUrl: track.streamUrl,
                        similarity: Math.min(rating + artistsSimilarity, 1),
                    };
                })
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        }

        getLists(sourceIds, { limit, offset, sourceRating, producerRating } = {}) {
            const sources = ((sourceIds) => {
                if (!sourceIds || !sourceIds.length) {
                    return Source.values();
                }

                return sourceIds.map((sourceId) => Source.fromId(sourceId));
            })(sourceIds);

            return Promise.all(sources.map(async (source) => {
                if (!source) {
                    return null;
                }

                const lists = await source.getLists({limit, offset, producerRating});

                if (!lists) {
                    return null;
                }

                return lists.map((list) => ({
                    id: list.id,
                    name: list.name,
                }));
            }));
        };

        async getList(listId, sourceId, {limit, offset, sourceRating, producerRating} = {}) {
            const tracks = await Source.fromId(sourceId).getList(listId, {limit, offset, producerRating});

            if (!tracks) {
                return null;
            }

            return tracks.map((track) => ({
                id: track.id,
                name: track.name,
                duration: track.duration,
                artists: track.artists.map(artist => ({name: artist.name})),
                picture: track.picture,
                source: track.source.id,
                streamUrl: track.streamUrl,
            }));
        }

        async getStreamUrls(id, sourceId, {sourceRating, producerRating} = {}) {
            return await Source.fromId(sourceId).getStreamUrls(id, {producerRating});
        }

        async getRecommend(track, sourceIds, {sourceRating, producerRating} = {}) {
            const sources = ((sourceIds) => {
                if (!sourceIds || !sourceIds.length) {
                    return Source.values();
                }

                return sourceIds.map((sourceId) => Source.fromId(sourceId));
            })(sourceIds);

            sources.sort(() => Math.random() - .5);

            for (const source of sources) {
                try {
                    const recommendedTrack = await (async (track) => {
                        if (track) {
                            const { name, artists } = track;

                                return await source.getRecommend(new Track(undefined, name, undefined, artists.map(artist => new Artist(artist))), {producerRating}) || null;
                        }

                        return null;
                    })(track);

                    if (recommendedTrack) {
                        return {
                            id: recommendedTrack.id,
                            name: recommendedTrack.name,
                            duration: recommendedTrack.duration,
                            artists: recommendedTrack.artists.map(artist => ({name: artist.name})),
                            picture: recommendedTrack.picture,
                            source: recommendedTrack.source.id,
                            streamUrl: recommendedTrack.streamUrl,
                        };
                    }
                } catch (e) { }
            }

            return null;
        }

        async getAlternativeTracks(name, artistNames, {limit = 10, offset, sourceIds, sourceRating, producerRating} = {}) {
            const sources = ((sourceIds) => {
                if (!sourceIds || !sourceIds.length) {
                    return Source.values();
                }

                return sourceIds.map((sourceId) => Source.fromId(sourceId));
            })(sourceIds);

            const tracks = (await Promise.all(sources.map((source) => source.getAlternativeTracks(new Track(undefined, name, undefined, artistNames.map(artistName => new Artist(artistName))), {
                limit,
                producerRating
            }))))
                .filter((matchedTracks) => matchedTracks)
                .flat();

            if (!tracks.length) {
                return [];
            }

            return stringSimilarity.findBestMatch(name, tracks.map(({name}) => name)).ratings
                .map(({rating}, i) => {
                    const track = tracks[i];

                    const artistsSimilarity = track.artists
                        .map((artist) => stringSimilarity.findBestMatch(artist.name, artistNames).bestMatch.rating)
                        .reduce((total, rating) => total + rating, 0) / track.artists.length;

                    return {
                        id: track.id,
                        name: track.name,
                        duration: track.duration,
                        artists: track.artists.map(artist => ({name: artist.name})),
                        picture: track.picture,
                        source: track.source.id,
                        streamUrl: track.streamUrl,
                        similarity: rating * .5 + artistsSimilarity * .5,
                    };
                })
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        }
    }
};
