/**
 * Created by qhyang on 2017/8/24.
 */

const http = require('http');

module.exports = function () {
    return {
        getCoordinates: function (ip, successCallback, failCallback) {
            const options = {
                hostname: 'ip-api.com',
                path: '/json/' + '220.181.57.217', //TODO: ip
                method: 'GET'
            };

            http.request(options, (res) => {
                res.setEncoding('utf8');

                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const dataParsed = JSON.parse(data);

                    successCallback({
                        latitude: dataParsed.lat,
                        longitude: dataParsed.lon
                    });
                });
            })
                .on('error', (err) => {
                    if (typeof failCallback === "function") {
                        failCallback(err);
                    }
                })
                .end();
        }
    };
};
