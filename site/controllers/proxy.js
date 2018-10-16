/**
 * Created by qhyang on 2018/4/27.
 */

const http = require('http'),
    https = require('https'),
    url = require('url');

const proxy = require('http-proxy-middleware'),
    cache = require('apicache').middleware;

const credentials = require('../credentials');

let location;

module.exports = {
    registerRoutes(app) {
        app.use('/soundcloud', cache('24 hours'), (req, res, next) => {
                https.get(`https://api.soundcloud.com${req.url}?client_id=${credentials.soundCloudClientId}`, originRes => {
                    if (originRes.statusCode > 300 && originRes.statusCode < 400 && originRes.headers.location) {
                        location = url.parse(originRes.headers.location);

                        req.originalUrl = location.path;

                        if (!location.protocol) {
                            location.protocol = 'https:';
                        }

                        if (!location.host) {
                            location.host = 'api.soundcloud.com';
                        }

                        req._targetLocation = location;
                    } else {
                        req._targetLocation = {
                            protocol: 'https:',
                            host: 'api.soundcloud.com'
                        };
                    }

                    next();
                });
        }, (req, res) => {
            proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res)
        });

        app.use('/netease', cache('24 hours'), async (req, res, next) => {
            let redirectLocation = url.parse(`http://music.163.com${req.url}`);

            const sendReq = location => {
                const client = (protocol => {
                    switch (protocol) {
                        case 'http:':
                            return http;
                        case 'https:':
                        default:
                            return https;
                    }
                })(location.protocol);

                return new Promise(resolve => {
                    client.get(location.href, res => resolve(res));
                });
            };

            while (true) {
                const originRes = await sendReq(redirectLocation);

                if (originRes.statusCode >= 200 && originRes.statusCode < 300) {
                    const location = redirectLocation;

                    req.originalUrl = location.href;

                    if (!location.protocol) {
                        location.protocol = 'https:';
                    }

                    if (!location.host) {
                        location.host = 'm10.music.126.net';
                    }

                    req._targetLocation = location;

                    next();

                    break;
                } else if (originRes.statusCode >= 300 && originRes.statusCode < 400 && originRes.headers.location) {
                    const location = url.parse(originRes.headers.location);

                    if (!location.protocol) {
                        location.protocol = 'https:';
                    }

                    if (!location.host) {
                        location.host = 'm10.music.126.net';
                    }

                    redirectLocation = location;
                } else {
                    throw 'Fetch error';
                }
            }

        }, (req, res) => {
            proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res);
        });

        app.use('/qq', cache('24 hours'), proxy({
            target: 'http://dl.stream.qqmusic.qq.com',
            changeOrigin: true
        }));

        app.use('/hearthis', cache('24 hours'), (req, res, next) => {
            https.get(`https://hearthis.at${req.url}`, originRes => {
                if (originRes.statusCode > 300 && originRes.statusCode < 400 && originRes.headers.location) {
                    const location = url.parse(originRes.headers.location);

                    req.originalUrl = location.href;

                    if (!location.protocol) {
                        location.protocol = 'https:';
                    }

                    if (!location.host) {
                        location.host = 'hearthis.at';
                    }

                    req._targetLocation = location;
                } else {
                    req._targetLocation = {
                        protocol: 'https:',
                        host: 'stream72.hearthis.at'
                    };
                }

                next();
            });
        }, (req, res) => {
            proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res);
        });

        app.use('/proxy', cache('24 hours'), (req, res) => {
            const url = req.url;

            proxy({
                target: `${req.protocol}:/${url.slice(0, url.indexOf('/', 1))}`,
                pathRewrite() {
                    return url.slice(url.indexOf('/', 1));
                },
                changeOrigin: true
            })(req, res);
        });
    }
};
