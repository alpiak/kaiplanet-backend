/**
 * Created by qhyang on 2018/1/30.
 */

const https = require('https'),
    querystring = require('querystring');

const qq = {
        getTopList() {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: 'c.y.qq.com',
                    path: '/v8/fcg-bin/fcg_v8_toplist_cp.fcg?tpl=3&page=detail&date=2018-03-06&topid=4&type=top&song_begin=0&song_num=30&g_tk=5381&jsonpCallback=&loginUin=0&hostUin=0&format=jsonp&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0',
                    method: 'GET'
                };

                https.request(options, (res) => {
                    res.setEncoding('utf8');

                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        const parsedData = JSON.parse(data);

                        resolve(parsedData);
                    });
                })
                    .on('error', (e) => {
                        reject(e);
                    })
                    .end();
            });
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

                https.request(options, (res) => {
                    res.setEncoding('utf8');

                    let data = '';

                    res.on('data', (chunk) => {
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
                    .on('error', (e) => {
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

                https.request(options, (res) => {
                    res.setEncoding('utf8');

                    let data = '';

                    res.on('data', (chunk) => {
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
                    .on('error', (e) => {
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

                https.request(options, (res) => {
                    res.setEncoding('utf8');

                    let data = '';

                    res.on('data', (chunk) => {
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
                    .on('error', (e) => {
                        reject(e);
                    })
                    .end();
            });
        }
    };

module.exports.qq = qq;
module.exports.hearthis = hearthis;