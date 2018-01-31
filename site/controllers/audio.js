/**
 * Created by qhyang on 2017/12/28.
 */

const apicache = require('apicache'),
    musicAPI = require('music-api');

const cache = apicache.middleware;

const hearthis = require('../libraries/audioSource').hearthis;

// Search util function for the sources 'netease', 'xiami' and 'qq'.
const search = async (keywords, source, limit) => {
    let tracks = (await musicAPI.searchSong(source, {
        key: keywords,
        limit
    })).songList;

    return {
        _tracks: tracks,
        get(index) {
            const track = this._tracks[index],
                getArtists = () => {
                    const output = [];

                    track.artists.forEach(artist => {
                        output.push({
                            name: artist.name
                        });
                    });

                    return output;
                };

            return {
                id: String(track.id),
                name: track.name,
                duration: track.duration,
                artists: getArtists(),
                picture: track.album.coverBig,
                source: source
            }
        },
        length: tracks.length
    };
};

const sources = {
    netease: {
        async search(keywords, limit) {
          return await search(keywords, 'netease', limit);
        },
        async getStreamUrl(id) {
          return (await musicAPI.getSong('netease', { id })).url;
        },
        channels: {
            hot: {
                async getList() {
                    return (await musicAPI.getPlaylist('netease', { id: 3778678 })).songList
                        .map(track => {
                            const getArtists = () => {
                                const output = [];

                                track.artists.forEach(artist => {
                                    output.push({
                                        name: artist.name
                                    });
                                });

                                return output;
                            };

                            return {
                                id: String(track.id),
                                name: track.name,
                                duration: track.duration,
                                artists: getArtists(),
                                picture: track.album.coverBig,
                                source: 'netease'
                            }
                        });
                }
            }
        }
    },
    // xiami: {
    //     async search(keywords, limit) {
    //         return await search(keywords, 'xiami', limit);
    //     },
    //     async getStreamUrl(id) {
    //         return (await musicAPI.getSong('xiami', { id })).url;
    //     }
    // },
    qq: {
        async search(keywords, limit) {
            return await search(keywords, 'qq', limit);
        },
        async getStreamUrl(id) {
            return (await musicAPI.getSong('qq', { id })).url;
        }
    },
    hearthis: {
        async search(keywords, limit) {
            const tracks = await hearthis.search(keywords, limit);

            return {
                _tracks: tracks,
                get(index) {
                    const track = this._tracks[index];

                    return {
                        id: String(track.id),
                        name: track.title,
                        duration: +track.duration * 1000,
                        artists: [{
                            name: track.user.username
                        }],
                        picture: track.artwork_url,
                        source: 'hearthis'
                    }
                },
                length: tracks.length
            };
        },
        async getStreamUrl(id) {
            return (await hearthis.getTrack(id)).stream_url;
        }
    }
};

module.exports = {
    registerRoutes(app) {
        app.post('/music/search', cache('5 minutes', () => true, {
            appendKey: (req, res) => req.body.keywords + (req.body.sources && req.body.sources.join()) + req.body.limit
        }), this.search);
        app.post('/music/streamurl', cache('5 minutes', () => true, {
            appendKey: (req, res) => req.body.id + req.body.source
        }), this.getStreamUrl);
        app.post('/music/altstreamurl', cache('5 minutes', () => true, {
            appendKey: (req, res) => req.body.name
        }), this.getAltStreamUrl);
        app.post('/music/list', cache('5 minutes', () => true, {
            appendKey: (req, res) => req.body.source + req.body.channel
        }), this.getList);
    },

    /**
     * @api {post} /music/search
     *
     * @apiParam keywords {String} The keywords to search
     * @apiParam sources {String[]} The sources to search in
     * @apiParam [limit] {Number} Optional The max number of items returned
     */
    async search(req, res) {
        try {
            const promises = [];

            if (!req.body.sources) {
                req.body.sources = Object.keys(sources);
            }

            let limit = req.body.limit || 20;

            req.body.sources.forEach(source => {
                promises.push(sources[source].search(req.body.keywords, limit));
            });

            const results = await Promise.all(promises),
                output = [];

            let len = 0;

            results.forEach(result => len += result.length);

            limit = Math.min(limit, len);

            loop1:for (let i = 0; output.length < limit; i++) {
                for (let j = 0, len = results.length; j < len; j++) {
                    const result = results[j];

                    if (output.length >= limit) {
                        break loop1;
                    }

                    if (i < result.length) {
                        output.push(result.get(i));
                    }
                }
            }

            res.json({
                code: 1,
                data: output
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    },

    async getStreamUrl(req, res) {
        try {
            res.json({
                code: 1,
                data: await sources[req.body.source].getStreamUrl(req.body.id)
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    },

    async getAltStreamUrl(req, res) {
        try {
            let promises = [];

            Object.values(sources).forEach(source => {
                promises.push(source.search({ keywords: req.body.name }));
            });

            const results = await Promise.all(promises);

            promises = [];

            results.forEach(result => {
                if (result.length) {
                    const track = result.get(0);

                    promises.push(sources[track.source].getStreamUrl(track.id));
                }
            });

            res.json({
                code: 1,
                data: await Promise.all(promises)
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    },

    async getList(req, res) {
        try {
            res.json({
                code: 1,
                data: await sources[req.body.source].channels[req.body.channel].getList({
                    limit: req.body.limit,
                    offset: req.body.offset
                })
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message
            });
        }
    }
};
