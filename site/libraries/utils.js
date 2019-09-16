const http = require("http");
const https = require("https");

const ProxyAgent = require("proxy-agent");

const request = (options) => new Promise((resolve, reject) => {
    const client = (() => {
        switch (options.protocol) {
            case 'http':
                return http;
            case 'https':
            default:
                return https;
        }
    })();

    const data = ((options) => {
        const data = options.data;

        if (!data) {
           return "";
        }

        if (options.method.toUpperCase() === "POST") {
            switch (typeof data) {
                case "string":
                    return data;
                case "object":
                    return JSON.stringify(data);
                default:
                    return "";
            }
        } else if (options.method.toUpperCase() === "GET") {
            switch (typeof data) {
                case "string":
                    return data;
                case "object":
                    return Object.entries(data)
                        .filter((entry) => entry.reduce((total, el) => total && el, true))
                        .map((entry) => entry.join("="))
                        .join("&");
                default:
                    return "";
            }
        }

        return "";
    })(options);

    const queries = (() => {
        if (typeof options.queries === "object") {
            Object.entries(options.queries)
                .filter((entry) => entry.reduce((total, el) => total && el, true))
                .map((entry) => entry.join("="))
                .join("&");
        }

        return "";
    })();

    const requestOptions = {
        ...options,
        path: (() => {
            if (options.method.toUpperCase() === "GET") {
                return options.path + "?" + encodeURI([data, queries].filter((queryStr) => queryStr).join("&"));
            } else if (queries) {
                return options.path + "?" + encodeURI(queries);
            }

            return options.path;
        })(),
        protocol: options.protocol + ":",
    };

    if (options.proxy) {
        requestOptions.agent = new ProxyAgent(options.proxy);
    }

    const req = client.request(requestOptions, (res) => {
        res.setEncoding('utf8');

        let data = '';

        res.on('data', chunk => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const parsedData = JSON.parse(data);

                resolve(parsedData);
            } catch (e) {
                reject(e);
            }
        });
    });

    req.on('error', e => {
        reject(e);
    });

    if (options.method.toUpperCase() === "POST") {
        req.write(data);
    }

    req.end();
});

module.exports = { request };
