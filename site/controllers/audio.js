/**
 * Created by qhyang on 2017/12/28.
 */

const https = require('https'),
    apicache = require('apicache'),
    musicAPI = require('music-api'),
    SC = require('node-soundcloud'),
    NeteaseCloudMusicApi = require('../vendors/NeteaseCloudMusicApi/NeteaseCloudMusicApi');

const credentials = require('../credentials');

const cache = apicache.middleware;

SC.get = (() => {
    const _SCGet = SC.get;

    return (path, params) => {
        return new Promise((resolve, reject) => {
            _SCGet.call(SC, path, params, (err, data) => {
                if (err) {
                    return reject(err);
                }

                resolve(data);
            });
        });
    }
})();

SC.init({ id: credentials.soundCloudClientId });

const audioSource = require('../libraries/audioSource'),
    qq = audioSource.qq,
    hearthis = audioSource.hearthis;

// Search util function for the sources 'netease', 'xiami' and 'qq'.
const search = async (keywords, source, limit) => {
    let tracks = (await musicAPI.searchSong(source, {
        key: keywords,
        limit
    })).songList;

    return {
        _tracks: tracks,
        get(index) {
            const track = this._tracks[index];

            if (!track) {
                return;
            }

            return {
                id: String(track.id),
                name: track.name,
                duration: track.duration,
                artists: track.artists.map(artist => {
                    return { name: artist.name };
                }),
                picture: track.album.coverBig,
                source: source
            };
        },
        length: tracks.length
    };
};

const sources = {
    soundcloud: {
        id: 'soundcloud',
        name: 'SoundCloud',

        async search(keywords, limit) {
            const tracks = await SC.get('/tracks', {
                q: keywords,
                limit
            });

            return {
                _tracks: tracks,
                get(index) {
                    const track = this._tracks[index];

                    return {
                        id: String(track.id),
                        name: track.title,
                        duration: +track.duration,
                        artists: [{ name: track.user.username }],
                        picture: track.artwork_url,
                        source: 'soundcloud'
                    }
                },
                length: tracks.length
            };
        },

        async getStreamUrl(id) {
            return (await SC.get('/tracks', { ids: String(id) }))[0].stream_url + `?client_id=${credentials.soundCloudClientId}`;
        },

        async getRecommend({ track: { name, artists } }) {
            let tracks;

            if (name) {
                const track = (await SC.get('/tracks', {
                    q: name,
                    limit: 1
                }))[0];

                if (track) {
                    tracks = await SC.get('/tracks', { tags: track.tag_list.replace(/\s*"(?:.|\n)*"/g, '').replace(/^\s*/g, '').split(/\s+/).join(',') });
                }

                if (tracks && tracks.length > 1) {
                    tracks = tracks.slice(1);
                }

                if (!tracks || !tracks.length) {
                    tracks = await SC.get('/tracks');
                }

                const randomTrack = tracks[Math.floor(tracks.length * Math.random())];

                return {
                    id: String(randomTrack.id),
                    name: randomTrack.title,
                    duration: +randomTrack.duration,
                    artists: [{ name: randomTrack.user.username }],
                    picture: track.artwork_url,
                    source: 'soundcloud'
                };
            }
        }
    },
    netease: {
        id: 'netease',
        name: '网易云音乐',

        async search(keywords, limit) {
            return await search(keywords, 'netease', limit);
        },

        async getStreamUrl(id) {
          return (await musicAPI.getSong('netease', { id })).url;
        },

        async getRecommend({ track: { name, artists } }) {
            let tracks;

            if (name) {
                const track = (await this.search(name + (artists ? artists.join('+') : ''), 1)).get(0);

                if (track) {
                    tracks = JSON.parse(await NeteaseCloudMusicApi.getSimilarSongs(track.id, 0, 20)).songs;
                }
            }

            if (!tracks || !tracks.length) {
                tracks = (await musicAPI.getPlaylist('netease', { id: 3778678 })).songList;

                const randomTrack = tracks[Math.floor(tracks.length * Math.random())];

                return {
                    id: String(randomTrack.id),
                    name: randomTrack.name,
                    duration: +randomTrack.duration,
                    artists: randomTrack.artists.map(artist => {
                        return { name: artist.name };
                    }),
                    picture: randomTrack.album.coverBig,
                    source: 'netease'
                };
            }

            const randomTrack = tracks[Math.floor(tracks.length * Math.random())];

            return {
                id: String(randomTrack.id),
                name: randomTrack.name,
                duration: +randomTrack.duration,
                artists: randomTrack.artists.map(artist => {
                    return { name: artist.name };
                }),
                picture: randomTrack.album.picUrl,
                source: 'netease'
            };
        },

        channels: {
            popular: {
                type: 'popular',
                name: '云音乐热歌榜',

                async getList() {
                    return (await musicAPI.getPlaylist('netease', { id: 3778678 })).songList
                        .map(track => {
                            return {
                                id: String(track.id),
                                name: track.name,
                                duration: track.duration,
                                artists: track.artists.map(artist => {
                                    return {
                                        name: artist.name
                                    }
                                }),
                                picture: track.album.coverBig,
                                source: 'netease'
                            };
                        });
                }
            },
            billboard: {
                type: 'billboard',
                name: '美国Billboard周榜',

                async getList() {
                    return (await musicAPI.getPlaylist('netease', { id: 60198 })).songList
                        .map(track => {
                            return {
                                id: String(track.id),
                                name: track.name,
                                duration: track.duration,
                                artists: track.artists.map(artist => {
                                    return {
                                        name: artist.name
                                    }
                                }),
                                picture: track.album.coverBig,
                                source: 'netease'
                            };
                        });
                }
            },
            oricon: {
                type: 'oricon',
                name: '日本Oricon周榜',

                async getList() {
                    return (await musicAPI.getPlaylist('netease', { id: 60131 })).songList
                        .map(track => {
                            return {
                                id: String(track.id),
                                name: track.name,
                                duration: track.duration,
                                artists: track.artists.map(artist => {
                                    return {
                                        name: artist.name
                                    }
                                }),
                                picture: track.album.coverBig,
                                source: 'netease'
                            };
                        });
                }
            },
            mnet: {
                type: 'mnet',
                name: '韩国Mnet排行榜周榜',

                async getList() {
                    return (await musicAPI.getPlaylist('netease', { id: 60255 })).songList
                        .map(track => {
                            return {
                                id: String(track.id),
                                name: track.name,
                                duration: track.duration,
                                artists: track.artists.map(artist => {
                                    return {
                                        name: artist.name
                                    }
                                }),
                                picture: track.album.coverBig,
                                source: 'netease'
                            };
                        });
                }
            },
            hito: {
                type: 'hito',
                name: '台湾Hito排行榜',

                async getList() {
                    return (await musicAPI.getPlaylist('netease', { id: 112463 })).songList
                        .map(track => {
                            return {
                                id: String(track.id),
                                name: track.name,
                                duration: track.duration,
                                artists: track.artists.map(artist => {
                                    return {
                                        name: artist.name
                                    }
                                }),
                                picture: track.album.coverBig,
                                source: 'netease'
                            };
                        });
                }
            },
            chinaTop: {
                type: 'chinaTop',
                name: '中国TOP排行榜(内地榜)',

                async getList() {
                    return (await musicAPI.getPlaylist('netease', { id: 64016 })).songList
                        .map(track => {
                            return {
                                id: String(track.id),
                                name: track.name,
                                duration: track.duration,
                                artists: track.artists.map(artist => {
                                    return {
                                        name: artist.name
                                    }
                                }),
                                picture: track.album.coverBig,
                                source: 'netease'
                            };
                        });
                }
            }
        }
    },
    // xiami: {
    //     id: 'xiami',
    //     name: '虾米音乐',

    //     async search(keywords, limit) {
    //         return await search(keywords, 'xiami', limit);
    //     },

    //     async getStreamUrl(id) {
    //         return (await musicAPI.getSong('xiami', { id })).url;
    //     }
    // },
    qq: {
        id: 'qq',
        name: 'QQ音乐',

        async search(keywords, limit) {
            return await search(keywords, 'qq', limit);
        },

        async getStreamUrl(id) {
            return (await musicAPI.getSong('qq', { id })).url;
        },

        async getRecommend({ track: { name, artists } }) {
            const tracks = (await qq.getTopList()).songlist,
                randomTrack = tracks[Math.floor(tracks.length * Math.random())];

            return {
                id: String(randomTrack.data.songmid),
                name: randomTrack.data.songname,
                duration: randomTrack.data.interval * 1000,
                artists: randomTrack.data.singer.map(artist => {
                    return { name: artist.name };
                }),
                picture: 'http://y.gtimg.cn/music/photo_new/T002R500x500M000' + randomTrack.data.albummid + '.jpg?max_age=2592000',
                source: 'qq'
            };
        },

        channels: {
            popular: {
                type: 'popular',
                name: '安利XS·巅峰榜·流行指数',

                async getList() {
                    return (await qq.getTopList()).songlist
                        .map(track => {
                            return {
                                id: String(track.data.songmid),
                                name: track.data.songname,
                                duration: track.data.interval * 1000,
                                artists: track.data.singer.map(artist => {
                                    return { name: artist.name };
                                }),
                                picture: 'http://y.gtimg.cn/music/photo_new/T002R500x500M000' + track.data.albummid + '.jpg?max_age=2592000',
                                source: 'qq'
                            };
                        });
                }
            }
        }
    },
    hearthis: {
        id: 'hearthis',
        name: 'hearthis.at',

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
            return (await hearthis.getTrack(id)).stream_url.replace(/^https/, 'http');
        },

        async getRecommend({ track: { name, artists } }) {
            const tracks = await hearthis.getFeed('popular'),
                randomTrack = tracks[Math.floor(tracks.length * Math.random())];

            return {
                id: String(randomTrack.id),
                name: randomTrack.title,
                duration: +randomTrack.duration * 1000,
                artists: [{
                    name: randomTrack.user.username
                }],
                picture: randomTrack.artwork_url,
                source: 'hearthis'
            };
        },

        channels: {
            popular: {
                type: 'popular',
                name: 'Popular',

                async getList() {
                    return (await hearthis.getFeed('popular'))
                        .map(track => {
                            return {
                                id: String(track.id),
                                name: track.title,
                                duration: +track.duration * 1000,
                                artists: [{
                                    name: track.user.username
                                }],
                                picture: track.artwork_url,
                                source: 'hearthis'
                            };
                        });
                }
            }
        }
    }
};

module.exports = {
    registerRoutes(app) {
        app.post('/audio/search', cache('5 minutes', () => true, {
            appendKey: (req, res) => JSON.stringify(req.body)
        }), this.search);

        app.post('/audio/streamurl', cache('5 minutes', () => true, {
            appendKey: (req, res) => JSON.stringify(req.body)
        }), this.getStreamUrl);

        app.post('/audio/altstreamurls', cache('5 minutes', () => true, {
            appendKey: (req, res) => JSON.stringify(req.body)
        }), this.getAltStreamUrls);

        app.post('/audio/list', cache('5 minutes', () => true, {
            appendKey: (req, res) => JSON.stringify(req.body)
        }), this.getList);

        app.post('/audio/sources', cache('5 minutes'), this.getSources);

        app.post('/audio/recommend', this.getRecommend);
    },

    /**
     * @api {post} /audio/search
     *
     * @apiParam {String} keywords The keywords to search
     * @apiParam {String[]} [sources] Optional Sources to search in
     * @apiParam {Number} [limit] Optional Max number of items returned
     */
    async search(req, res) {
        try {
            if (!req.body.sources || !req.body.sources.length) {
                req.body.sources = Object.keys(sources);
            }

            const promises = [];

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

    /**
     * @api {post} /audio/altstreamurls
     *
     * @apiParam {String} name The song name
     */
    async getAltStreamUrls(req, res) {
        try {
            let promises = [];

            Object.values(sources).forEach(source => {
                promises.push(source.search(req.body.name));
            });

            const results = (await Promise.all(promises)).filter(result => result.length);

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

    /**
     * @api {post} /audio/list
     *
     * @apiParam {String} source The source ID of the list
     * @apiParam {String} channel The channel ID of the list
     * @apiParam {Number} [limit] Optional Max number of items returned
     * @apiParam {Number} [offset] Optional Offset to get items
     */
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
    },

    async getSources(req, res) {
        try {
            res.json({
                code: 1,
                data: Object.values(sources).map(source => {
                    return {
                        id: source.id,
                        name: source.name,
                        channels: !source.channels ? [] : Object.values(source.channels).map(channel => {
                            return {
                                type: channel.type,
                                name: channel.name
                            }
                        })
                    }
                })
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
     * @apiParam {String[]} [sources] Optional Sources to search in
     */
    async getRecommend(req, res) {
        try {
            if (!req.body.sources || !req.body.sources.length) {
                req.body.sources = Object.keys(sources);
            }

            const randomSource = sources[req.body.sources[Math.floor(req.body.sources.length * Math.random())]];

            res.json({
                code: 1,
                data: await randomSource.getRecommend({
                    track: req.body.track ? {
                        name: req.body.track.name,
                        artists: req.body.track.artists
                    } : {}
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
