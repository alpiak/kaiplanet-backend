/**
 * Created by qhyang on 2017/4/27.
 */

const https = require('https');

module.exports = {
    registerRoutes: function(app) {
        app.post('/weather', this.darkSky);
    },

    darkSky: (req, res) => {
        const ip = require('../services/request')(req).getClientIp();

        require('../services/location')().getLocation(ip, (location) => {
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
