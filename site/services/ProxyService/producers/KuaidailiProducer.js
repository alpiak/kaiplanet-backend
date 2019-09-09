const phantom = require('phantom');

module.exports = ({ Area, Proxy, Producer, config }) => class KuaidailiProducer extends Producer {
    static areas = new Set([Area.CN]);

    static getInstances() {
        return config.producers.kuaidaili.instances.map((instance) => new Producer.Instance(instance.host, instance.port, instance.protocol, instance.path));
    }

    async fetchProxyList(length, area = Area.GLOBAL, proxy) {
        if (!KuaidailiProducer.areas.has(area)) {
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

            await page.setting("userAgent", config.producers.kuaidaili.userAgent);

            const status = await page.open(`${this._protocol}://${this._host}:${this._port}${this._path}`);

            if (status === "success") {
                const entries = await page.evaluate(function() {
                    return Array.prototype.slice.call(document.querySelectorAll("table tbody tr"), 1).map(function(tr) {
                        return Array.prototype.map.call(tr.querySelectorAll("td"), function(td) {
                            return td.innerText.trim();
                        });
                    });
                });

                instance.exit();

                return entries.map((entry) => {
                    const proxies = [];
                    const proxy = new Proxy(entry[0], "http", entry[1], area);

                    proxy.historyResponseTime.push(parseFloat(entry[5]) * 1000);
                    proxies.push(proxy);

                    if (entry[3].toLowerCase() === "https") {
                        const httpsProxy = new Proxy(entry[0], "https", entry[1], area);

                        httpsProxy.historyResponseTime.push(parseFloat(entry[5]) * 1000);
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
