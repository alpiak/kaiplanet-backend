/**
 * Created by qhyang on 2017/4/27.
 */

const express = require('express');
const proxy = require('http-proxy-middleware');

// proxy middleware options
let options = {
    target: 'https://api.darksky.net', // Target host
    changeOrigin: true, // Needed for virtual hosted sites
    pathRewrite: {
        '^/weather' : '/forecast/' + require('../credentials').darkSkyKey + '/' // Add base path
    }
};

module.exports = {
    registerRoutes: function(app) {
        app.use('/weather', this.darkSkyProxy);
    },

    darkSky: (req, res) => {
        const ip = require('../libraries/request')(req).getClientIp();

        require('../libraries/location')().getLocation(ip, (location) => {
            const options = {
                hostname: 'api.darksky.net',
                path: '/forecast/' + require('../credentials').darkSkyKey + '/' + location.coords.latitude + ',' + location.coords.longitude,
                method: 'GET'
            };

            https.request(options, (darkSkyRes) => {
                darkSkyRes.setEncoding('utf8');

                let data = '';

                darkSkyRes.on('data', (chunk) => {
                    data += chunk;
                });
                darkSkyRes.on('end', () => {
                    res.send('{"code":1,"data":{"detail":' + data + ',"location":{"city":"' + location.city + '"}}}');
                });
            })
                .on('error', (err) => {
                    res.json({
                        code: -1,
                        message: 'Query Failed - ' + err.message
                    });
                })
                .end();
        });
    }
};
