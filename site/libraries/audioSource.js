/**
 * Created by qhyang on 2018/1/30.
 */

const https = require('https'),
    querystring = require('querystring');

const { request } = require('./utils');

const qq = {
        async getTrackStreamUrl(id) {
            return (await request({
                protocol: 'https:',
                hostname: 'music.niubishanshan.top',
                path: `/api/v2/music/songUrllist/${id}`,
                method: 'GET'
            })).data;
        },

        async getLists() {
            return (await request({
                protocol: 'https:',
                hostname: 'music.niubishanshan.top',
                path: `/api/v2/music/toplist`,
                method: 'GET'
            })).data;
        },

        async getList(id) {
            return (await request({
                protocol: 'https:',
                hostname: 'music.niubishanshan.top',
                path: `/api/v2/music/songList/${id}`,
                method: 'GET'
            })).data;
        }
    },

    hearthis = {
        search(keywords, limit) {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api-v2.hearthis.at',
                    path: '/search/?t=' + querystring.escape(keywords.replace(' ', '+')) + '&page=1&count=' + limit,
                    method: 'GET'
                };

                https.request(options, res => {
                    res.setEncoding('utf8');

                    let data = '';

                    res.on('data', chunk => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        data = JSON.parse(data);

                        if (data.success === false) {
                            resolve([]);
                        } else {
                            resolve(data);
                        }
                    });
                })
                    .on('error', e => {
                        reject(e);
                    })
                    .end();
            });
        },

        getTrack(id) {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api-v2.hearthis.at',
                    path: '/' + id + '/',
                    method: 'GET'
                };

                https.request(options, res => {
                    res.setEncoding('utf8');

                    let data = '';

                    res.on('data', chunk => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        const parsedData = JSON.parse(data);

                        if (parsedData.id) {
                            resolve(parsedData);
                        } else {
                            resolve([]);
                        }
                    });
                })
                    .on('error', e => {
                        reject(e);
                    })
                    .end();
            });
        },

        /**
         * Get feed.
         * @param {string="popular","new"} type
         */
        getFeed (type) {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api-v2.hearthis.at',
                    path: '/feed/?type=' + type,
                    method: 'GET'
                };

                https.request(options, res => {
                    res.setEncoding('utf8');

                    let data = '';

                    res.on('data', chunk => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        const parsedData = JSON.parse(data);

                        if (Object.prototype.toString.call(parsedData)=='[object Array]') {
                            resolve(parsedData);
                        } else {
                            resolve([]);
                        }
                    });
                })
                    .on('error', e => {
                        reject(e);
                    })
                    .end();
            });
        }
    };

module.exports.qq = qq;
module.exports.hearthis = hearthis;