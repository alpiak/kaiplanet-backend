/**
 * Created by qhyang on 2018/1/30.
 */

const https = require('https');

const hearthis = {
    async search(keywords, limit) {
        return await new Promise((resolve, reject) => {
            const options = {
                hostname: 'api-v2.hearthis.at',
                path: '/search/?t=' + keywords.replace(' ', '+') + '&page=1&count=' + limit,
                method: 'GET'
            };

            https.request(options, (res) => {
                res.setEncoding('utf8');

                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve(JSON.parse(data));
                });
            })
                .on('error', (e) => {
                    reject(e);
                })
                .end();
        });
    },
    async getTrack(id) {
        return await new Promise((resolve, reject) => {
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
                    resolve(JSON.parse(data));
                });
            })
                .on('error', (e) => {
                    reject(e);
                })
                .end();
        });
    }
};

module.exports.hearthis = hearthis;