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
                        try {
                            const parsedData = JSON.parse(data);

                            resolve({
                                coords: {
                                    latitude: parsedData.lat,
                                    longitude: parsedData.lon,
                                },
                                city: parsedData.city,
                                areaCode: parsedData.countryCode,
                            });
                        } catch (e) {
                            reject(e);
                        }
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
