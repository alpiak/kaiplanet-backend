/**
 * Created by qhyang on 2017/4/27.
 */

const https = require('https');

module.exports = {
    registerRoutes: function(app) {
        app.post('/weather', this.darkSky);
    },

    darkSky: (req, res) => {
        const ip = require('../libraries/request')(req).getClientIp();

        require('../libraries/location')().getCoordinates(ip, (coords) => {
            const options = {
                hostname: 'api.darksky.net',
                path: '/forecast/' + require('../credentials').darkSkyKey + '/' + coords.latitude + ',' + coords.longitude,
                method: 'GET'
            };

            https.request(options, (darkSkyRes) => {
                darkSkyRes.setEncoding('utf8');

                let data = '';

                darkSkyRes.on('data', (chunk) => {
                    data += chunk;
                });
                darkSkyRes.on('end', () => {
                    res.send(data);
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
