/**
 * Created by qhyang on 2018/4/27.
 */

const http = require('http');
const https = require('https');
const url = require('url');
const _proxy = require('http-proxy-middleware');

const { proxy } = require('../services/proxy');

module.exports = {
    registerRoutes(app) {
        app.use('/kaiplanet', _proxy({
            target: 'http://kaiplanet.net',
            pathRewrite: {
                '^/kaiplanet' : '/'
            },
            changeOrigin: true
        }));

        app.use('/soundcloud', (req, res, next) => {
            let location;

            https.get(`https://api.soundcloud.com${req.url}`, originRes => {
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
            _proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res)
        });

        app.use('/netease', async (req, res, next) => {
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
            _proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res);
        });

        app.use('/qq', _proxy({
            target: 'http://dl.stream.qqmusic.qq.com',
            pathRewrite: {
                '^/qq' : ''
            },
            changeOrigin: true
        }));

        app.use('/hearthis', (req, res, next) => {
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
            _proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res);
        });

        app.use('/proxy', proxy());
    }
};
