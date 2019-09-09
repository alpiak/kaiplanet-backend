/**
 * Created by qhyang on 2017/12/28.
 */

const apicache = require('apicache');

const cache = apicache.middleware;

const AudioSourceService = require("../services/audioSource")(process.env.NODE_ENV);
const Source = require("../services/audioSource/Source")();

const audioSourceService = new AudioSourceService();

const generateResponse = (reqBody, callback) => {
    const generate = async (query) => {
        try {
            return {
                code: 1,
                data: await callback(query),
            };
        } catch (e) {
            return {
                code: -1,
                message: 'Query Failed - ' + e.message,
            };
        }
    };

    if (Array.isArray(reqBody)) {
        return Promise.all(reqBody.map(generate));
    }

    return generate(reqBody);
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
        res.json(await generateResponse(req.body, (reqBody) => {
            return audioSourceService.search(reqBody.keywords, {
                sourceIds: reqBody.sources,
                limit: reqBody.limit,
            })
        }));
    },

    /**
     * @api {post} /audio/streamurls
     *
     * @apiParam {String} id
     * @apiParam {String} source
     */
    async getStreamUrl(req, res) {
        res.json(await generateResponse(req.body, (reqBody) => audioSourceService.getStreamUrls(reqBody.id, reqBody.source)));
    },

    /**
     * @api {post} /audio/lists
     *
     * @apiParam {String} source ID of the source to get lists from
     */
    async getLists(req, res) {
        res.json(await generateResponse(((reqBody) => {
            if ((!Array.isArray(reqBody) && !reqBody.source) || (Array.isArray(reqBody) && !reqBody.length)) {
                return Source.values().map((source) => ({ source: source.id }))
            }

            return reqBody;
        })(req.body), async (reqBody) => {
            if (!reqBody.source) {
                throw new Error("Source not provided or doesn't exist.");
            }

            return (await audioSourceService.getLists([reqBody.source]))[0];
        }));
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
        res.json(await generateResponse(req.body, (list) => audioSourceService.getList(list.id, list.source, {
            limit: list.limit,
            offset: list.offset,
        })));
    },

    /**
     * @api {post} /audio/sources
     */
    async getSources(req, res) {
        res.json(await generateResponse(req.body, () => AudioSourceService.getSources()));
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
        res.json(await generateResponse(req.body, (reqBody) => audioSourceService.getRecommend(reqBody.track ? {
            name: reqBody.track.name,
            artists: reqBody.track.artists
        } : null, reqBody.sources)));
    },

    /**
     * @api {post} /audio/alttracks
     *
     * @apiParam {String} name The song name
     * @apiParam {String[]} artists List of artist names
     * @apiParam {String[]} [sources] Optional Sources to search by
     */
    async getAlternativeTracks(req, res) {
        res.json(await generateResponse(req.body, (reqBody) => audioSourceService.getAlternativeTracks(reqBody.name, reqBody.artists, { sourceIds: reqBody.sources })));
    },
};
