const http = require("http");

module.exports = (env = "development") => {
    const config = require(`./config/${env}`);

    return class LocationService {
        _instance;

        constructor() {
            this._instance = {
                hostname: config.IpApi.instances[0].hostname,
                path: config.IpApi.instances[0].path,
                method: config.IpApi.instances[0].method,
            }
        }

        getLocation(ip) {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: this._instance.hostname,
                    path: this._instance.path + ip,
                    method: this._instance.method,
                };

                http.request(options, (res) => {
                    res.setEncoding('utf8');

                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        const dataParsed = JSON.parse(data);

                        resolve({
                            coords: {
                                latitude: dataParsed.lat,
                                longitude: dataParsed.lon,
                            },
                            city: dataParsed.city,
                            areaCode: dataParsed.countryCode,
                        });
                    });
                })
                    .on('error', (err) => {
                        reject(err);
                    })
                    .end();
            });
        }
    }
};
