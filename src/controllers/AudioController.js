/**
 * Created by qhyang on 2017/12/28.
 */

const apicache = require('apicache');
const { pipe } = require("mississippi");

const cache = apicache.middleware;

const { generateResponse } = require("../libraries/utils");

module.exports = ({ AudioSourceService }) => class {
    set audioSourceService(audioSourceService) {
        this._audioSourceService = audioSourceService;
    }

    set proxyService(proxyService) {
        this._proxyService = proxyService;
    }

    _audioSourceService;
    _proxyService;

    registerRoutes(app) {
        app.post('/audio/track', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), (req, res) => this.getTrack(req, res));

        app.post('/audio/search', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), (req, res) => this.search(req, res));

        app.post('/audio/playbacksources', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), (req, res) => this.getPlaybackSources(req, res));

        app.post('/audio/lists', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), (req, res) => this.getLists(req, res));

        app.post('/audio/list', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), (req, res) => this.getList(req, res));

        app.post('/audio/sources', cache('5 minutes'), (req, res) => this.getSources(req, res));

        app.post('/audio/recommend', (req, res) => this.getRecommend(req, res));

        app.post('/audio/alttracks', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), (req, res) => this.getAlterTracks(req, res));

        app.get("/audio/stream/:source/:id/:options?", (req, res, next) => this.stream(req, res, next));
    }

    /**
     * @api {post} /audio/track
     *
     * @apiParam {String} id The ID of the track
     * @apiParam {String} source The source ID of the track
     * @apiParam {Number{0-1}} [playbackQuality=0] Expected playback quality
     */
    async getTrack(req, res) {
        res.json(await generateResponse(req.body, (reqBody) => this._audioSourceService.getTrack(reqBody.id, reqBody.source, { playbackQuality: reqBody.playbackQuality || 0 })));
    }

    /**
     * @api {post} /audio/search
     *
     * @apiParam {String} keywords The keywords to search
     * @apiParam {String[]} [sources] Optional IDs of the sources to search in
     * @apiParam {Number} [limit] Optional Max number of items returned
     * @apiParam {Number{0-1}} [playbackQuality=0] Expected playback quality
     */
    async search(req, res) {
        res.json(await generateResponse(req.body, (reqBody) => {
            return this._audioSourceService.search(reqBody.keywords, {
                sourceIds: reqBody.sources,
                limit: reqBody.limit,
                playbackQuality: reqBody.playbackQuality || 0,
            })
        }));
    }

    /**
     * @api {post} /audio/playbacksources
     *
     * @apiParam {String} id
     * @apiParam {String} source
     * @apiParam {Number{0-1}} [playbackQuality=0] Expected playback quality
     */
    async getPlaybackSources(req, res) {
        res.json(await generateResponse(req.body, (reqBody) => this._audioSourceService.getPlaybackSources(reqBody.id, reqBody.source.trim(), { playbackQuality: reqBody.playbackQuality || 0 })));
    }

    /**
     * @api {post} /audio/lists
     *
     * @apiParam {String} source ID of the source to get lists from
     */
    async getLists(req, res) {
        res.json(await generateResponse(await (async (reqBody) => {
            if ((!Array.isArray(reqBody) && (!reqBody.source || !reqBody.source.trim())) || (Array.isArray(reqBody) && !reqBody.length)) {
                return (await AudioSourceService.getSources()).map((source) => ({ source: source.id }))
            }

            return reqBody;
        })(req.body), async (reqBody) => {
            if (!reqBody.source) {
                throw new Error("Source not provided or doesn't exist.");
            }

            return (await this._audioSourceService.getLists({
                sourceIds: reqBody.source.trim(),
                timeout: reqBody.timeout,
            }));
        }));
    }

    /**
     * @api {post} /audio/list
     *
     * @apiParam {String} id The list ID of the list
     * @apiParam {String} source The source ID of the list
     * @apiParam {Number} [limit] Optional Max number of items returned
     * @apiParam {Number} [offset] Optional Offset to get items
     * @apiParam {Number{0-1}} [playbackQuality=0] Expected playback quality
     */
    async getList(req, res) {
        res.json(await generateResponse(req.body, (list) => this._audioSourceService.getList(list.id, list.source, {
            limit: list.limit,
            offset: list.offset,
            playbackQuality: req.body.playbackQuality || 0,
        })));
    }

    /**
     * @api {post} /audio/sources
     */
    async getSources(req, res) {
        res.json(await generateResponse(req.body, () => AudioSourceService.getSources()));
    }

    /**
     * @api {post} /audio/recommend
     *
     * @apiParam {Object} [track]
     * @apiParam {String} [track.name] Optional Track name.
     * @apiParam {String[]} [track.artists] Optional Artist names.
     * @apiParam {String[]} [sources] Optional Sources to search by.
     * @apiParam {Number{0-1}} [playbackQuality=0] Expected playback quality.
     * @apiParam {Boolean} [retrievePlaybackSource=false] Optional Switch to force retrieving playback source or not.
     * @apiParam {Boolean} [withPlaybackSourceOnly=false] Optional Switch to return tracks with playback source only.
     */
    async getRecommend(req, res) {
        res.json(await generateResponse(req.body, (reqBody) => this._audioSourceService.getRecommend(reqBody.track ? {
            name: reqBody.track.name,
            artists: reqBody.track.artists,
        } : null, {
            sourceIds: reqBody.sources,
            playbackQuality: reqBody.playbackQuality || 0,
            retrievePlaybackSource: reqBody.retrievePlaybackSource || false,
            withPlaybackSourceOnly: reqBody.withPlaybackSourceOnly || false,
        })));
    }

    /**
     * @api {post} /audio/alttracks
     *
     * @apiParam {String} name The song name.
     * @apiParam {String[]} artists List of artist names.
     * @apiParam {String[]} [sources] Optional Sources to search by.
     * @apiParam {String[]} [exceptedTracks] Optional IDs of the tracks to except from the result.
     * @apiParam {String[]} [exceptedSources] Optional IDs of the sources excepted for search.
     * @apiParam {Boolean} [exactMatch=false] Optional Switch whether to return the results of which the similarity is 1 only.
     * @apiParam {Object} [similarityRange] Optional Similarity range to filter the results.
     * @apiParam {Number{0-1}} [similarityRange.high] Optional The highest similarity.
     * @apiParam {Number{0-1}} [similarityRange.low] Optional The lowest similarity.
     * @apiParam {Number{0-1}} [playbackQuality=0] Expected playback quality.
     * @apiParam {Boolean} [retrievePlaybackSource=false] Optional Switch to force retrieving playback source or not.
     * @apiParam {Boolean} [withPlaybackSourceOnly=false] Optional Switch to return tracks with playback source only.
     * @apiParam {Number} [timeout] Optional Timeout for each call in milliseconds.
     */
    async getAlterTracks(req, res) {
        res.json(await generateResponse(req.body, (reqBody) => this._audioSourceService.getAlterTracks(reqBody.name, reqBody.artists, {
            sourceIds: reqBody.sources,
            exceptedSourceIds: reqBody.exceptedSources,
            exceptedIds: reqBody.exceptedTracks,
            similarityRange: reqBody.similarityRange ? {
                high: reqBody.similarityRange.high,
                low: reqBody.similarityRange.low,
            } : undefined,
            exactMatch: reqBody.exactMatch || false,
            playbackQuality: reqBody.playbackQuality || 0,
            retrievePlaybackSource: reqBody.retrievePlaybackSource || false,
            withPlaybackSourceOnly: reqBody.withPlaybackSourceOnly || false,
            timeout: reqBody.timeout,
        })));
    }

    /**
     * @api {get} /audio/stream/:source/:id/:options?
     *
     * @apiParam {String} id Track ID.
     * @apiParam {String} source Source ID.
     * @apiParam {String} [options] Optional Options object encoded as JSON string.
     * @apiParam {Number{0-1}} [options.quality=0] Optional Expected playback quality.
     * @apiParam {Number} [options.timeToWait=0] Optional Time to wait before fetching for sources with lower priority.
     * @apiParam {Object} [options.alterTracks] Optional Options for alternative tracks
     * @apiParam {Object} [options.alterTracks.track] Optional Track for which to get alternative tracks.
     * @apiParam {String} [options.alterTracks.track.name] Optional Song name.
     * @apiParam {String[]} [options.alterTracks.track.artists] Optional List of artist names.
     * @apiParam {String[]} [options.alterTracks.sources] Optional Sources to search by.
     * @apiParam {String[]} [options.alterTracks.exceptedSources] Optional Sources excepted for search.
     * @apiParam {Boolean} [options.alterTracks.exactMatch=false] Optional Flag whether to return the results of which the similarity is 1 only.
     * @apiParam {Object} [options.alterTracks.similarityRange] Optional Similarity range to filter the results.
     * @apiParam {Number{0-1}} [options.alterTracks.similarityRange.high] Optional The highest similarity.
     * @apiParam {Number{0-1}} [options.alterTracks.similarityRange.low] Optional The lowest similarity.
     */
    async stream(req, res, next) {
        const options = (() => {
            if (!req.params.options) {
                return {};
            }

            return JSON.parse(req.params.options);
        })();

        try {
            const stream = await this._audioSourceService.getStream(req.params.id, req.params.source, {
                quality: +options.quality || 0,
                timeToWait: options.timeToWait || 0,
                alterTracks: options.alterTracks ? {
                    track: options.alterTracks.track ? {
                        name: options.alterTracks.track.name,
                        artistNames: options.alterTracks.track.artists,
                    }: undefined,
                    sourceIds: options.alterTracks.sources,
                    exceptedSourceIds: options.alterTracks.exceptedSources,
                    exactMatch: options.alterTracks.exactMatch,
                    similarityRange: options.alterTracks.similarityRange ? {
                        high: options.alterTracks.similarityRange.high,
                        low: options.alterTracks.similarityRange.low,
                    } : undefined,
                } : undefined,
            });

            if (!stream) {
                return next();
            }

            res.status(stream.statusCode);

            for (const [key, value] of Object.entries(stream.headers)) {
                res.set(key, value);
            }

            pipe(stream, res, (err) => {
                if (err) {
                    return next(err);
                }
            });
        } catch (e) {
            return next(e);
        }
    }
};
