const phantom = require('phantom');

module.exports = ({ Area, Proxy, Producer, config }) => class XiciDailiProducer extends Producer {
    static areas = new Set([Area.CN]);

    static getInstances() {
        return config.producers.xiciDaili.instances.map((instance) => new Producer.Instance(instance.host, instance.port, instance.protocol, instance.path));
    }

    async fetchProxyList(length, area = Area.GLOBAL, proxy) {
        if (!XiciDailiProducer.areas.has(area)) {
            return [];
        }

        const instance = await phantom.create();

        try {
            const page = await (async () => {
                if (proxy) {
                    return await instance.createPage([`--proxy=${proxy.host}:${proxy.port}`]);
                }

                return await instance.createPage();
            })();

            await page.setting("userAgent", config.producers.xiciDaili.userAgent);

            const status = await page.open(`${this._protocol}://${this._host}:${this._port}${this._path}`);

            if (status === "success") {
                const entries = await page.evaluate(function() {
                    return Array.prototype.slice.call(document.querySelectorAll("#ip_list tbody tr"), 1).map(function(tr) {
                        return Array.prototype.map.call(tr.querySelectorAll("td"), function(td, i) {
                            if (i === 6 || i === 7) {
                                return td.querySelector("div").getAttribute("title")
                            }

                            return td.innerText.trim();
                        });
                    });
                });

                instance.exit();

                return entries.map((entry) => {
                    const proxies = [];
                    const proxy = new Proxy(entry[1], "http", entry[2], area);

                    proxy.historyResponseTime.push(parseFloat(entry[7]) * 1000);
                    proxies.push(proxy);

                    if (entry[5].toLowerCase() === "https") {
                        const httpsProxy = new Proxy(entry[1], "https", entry[2], area);

                        httpsProxy.historyResponseTime.push(parseFloat(entry[7]) * 1000);
                        proxies.push(httpsProxy);
                    }

                    return proxies;
                }).flat().slice(0, length);
            } else {
                throw Error(`Failed to open page, status: ${status}`);
            }
        } catch (e) {
            instance.exit();

            throw e;
        }
    }
};
