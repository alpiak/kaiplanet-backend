/**
 * Created by qhyang on 2018/4/27.
 */

const https = require('https'),
    url = require('url');

const proxy = require('http-proxy-middleware');

const credentials = require('../credentials');

let location;

module.exports = {
    registerRoutes(app) {
        app.use('/soundcloud', (req, res, next) => {
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

        app.use('/netease', proxy({
            target: 'http://m10.music.126.net',
            changeOrigin: true,
            pathRewrite: {
                '^/netease' : '/'
            }
        }));

        app.use('/qq', proxy({
            target: 'http://dl.stream.qqmusic.qq.com',
            changeOrigin: true,
            pathRewrite: {
                '^/qq' : '/'
            }
        }));

        app.use('/hearthis', (req, res, next) => {
            https.get(`https://hearthis.at${req.url}`, originRes => {
                if (originRes.statusCode > 300 && originRes.statusCode < 400 && originRes.headers.location) {
                    location = url.parse(originRes.headers.location);

                    req.originalUrl = location.path;

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
                        host: 'hearthis.at'
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
    }
};
