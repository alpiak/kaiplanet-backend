/**
 * Created by qhyang on 2017/12/28.
 */

const apicache = require('apicache');

const cache = apicache.middleware;

const AudioSourceService = require("../services/audioSource")(process.env.NODE_ENV);

const audioSourceService = new AudioSourceService();

const processReqBody = (reqBody, callback) => {
    if (Array.isArray(reqBody)) {
        return Promise.all(reqBody.map(callback));
    }

    return callback(reqBody);
};

module.exports = {
    registerRoutes(app) {
        app.post('/audio/search', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), this.search);

        app.post('/audio/streamurls', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), this.getStreamUrl);

        app.post('/audio/lists', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), this.getLists);

        app.post('/audio/list', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), this.getList);

        app.post('/audio/sources', cache('5 minutes'), this.getSources);

        app.post('/audio/recommend', this.getRecommend);

        app.post('/audio/alttracks', cache('5 minutes', () => true, {
            appendKey: (req) => JSON.stringify(req.body)
        }), this.getAlternativeTracks);
    },

    /**
     * @api {post} /audio/search
     *
     * @apiParam {String} keywords The keywords to search
     * @apiParam {String[]} [sources] Optional IDs of the sources to search in
     * @apiParam {Number} [limit] Optional Max number of items returned
     */
    async search(req, res) {
        try {
            res.json({
                code: 1,
                data: await processReqBody(req.body, (reqBody) => {
                    return audioSourceService.search(reqBody.keywords, {
                        sourceIds: reqBody.sources,
                        limit: reqBody.limit,
                    })
                }),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message,
            });
        }
    },

    /**
     * @api {post} /audio/streamurls
     *
     * @apiParam {String} id
     * @apiParam {String} source
     */
    async getStreamUrl(req, res) {
        try {
            res.json({
                code: 1,
                data: await processReqBody(req.body, (reqBody) => audioSourceService.getStreamUrls(reqBody.id, reqBody.source)),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message,
            });
        }
    },

    /**
     * @api {post} /audio/lists
     *
     * @apiParam {String} source ID of the source to get lists from
     */
    async getLists(req, res) {
        try {
            res.json({
                code: 1,
                data: await (async () => {
                    if (Array.isArray(req.body)) {
                        return await audioSourceService.getLists(req.body.map((reqBody) => (reqBody && reqBody.source)) || null);
                    }

                    return (await audioSourceService.getLists([req.body.source]))[0];
                })(),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    },

    /**
     * @api {post} /audio/list
     *
     * @apiParam {String} id The list ID of the list
     * @apiParam {String[]} source The source ID of the list
     * @apiParam {Number} [limit] Optional Max number of items returned
     * @apiParam {Number} [offset] Optional Offset to get items
     */
    async getList(req, res) {
        try {
            res.json({
                code: 1,
                data: await processReqBody(req.body, async (list) => {
                    return (await audioSourceService.getList(list.id, list.source, {
                        limit: list.limit,
                        offset: list.offset,
                    }))
                }),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    },

    /**
     * @api {post} /audio/sources
     */
    async getSources(req, res) {
        try {
            res.json({
                code: 1,
                data: AudioSourceService.getSources(),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    },

    /**
     * @api {post} /audio/recommend
     *
     * @apiParam {Object} [track]
     * @apiParam {String} [track.name] Optional Track name
     * @apiParam {String[]} [track.artists] Optional Artist names
     * @apiParam {String[]} [sources] Optional Sources to search by
     */
    async getRecommend(req, res) {
        try {
            res.json({
                code: 1,
                data: await processReqBody(req.body, (reqBody) => {
                    return audioSourceService.getRecommend(reqBody.track ? {
                        name: reqBody.track.name,
                        artists: reqBody.track.artists
                    } : null, reqBody.sources)
                }),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    },

    /**
     * @api {post} /audio/alttracks
     *
     * @apiParam {String} name The song name
     * @apiParam {String[]} artists List of artist names
     * @apiParam {String[]} [sources] Optional Sources to search by
     */
    async getAlternativeTracks(req, res) {
        try {
            res.json({
                code: 1,
                data: await processReqBody(req.body, (reqBody) => audioSourceService.getAlternativeTracks(reqBody.name, reqBody.artists, { sourceIds: reqBody.sources })),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    },
};
