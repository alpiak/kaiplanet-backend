const http = require('http'),
    https = require('https');

const request = options => new Promise((resolve, reject) => {
    const client = (() => {
        switch (options.protocol) {
            case 'http:':
                return http;
            case 'https':
            default:
                return https;
        }
    })();

    client.request(options, res => {
        res.setEncoding('utf8');

        let data = '';

        res.on('data', chunk => {
            data += chunk;
        });

        res.on('end', () => {
            const parsedData = JSON.parse(data);

            resolve(parsedData);
        });
    })
        .on('error', e => {
            reject(e);
        })
        .end();
});

module.exports = { request };
