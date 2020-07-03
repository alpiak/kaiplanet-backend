import IProducer from "../IProducer";
import IProducerConstructOptions from "../IProducerConstructOptions";
import IProducerOptions from "../IProducerMethodOptions";

import Area from "../Area";
import Instance from "../Instance";
import Producer from "../Producer";
import Proxy from "../Proxy";

export default class XiciDailiProducer extends Producer implements IProducer  {
    public static areas = new Set([Area.CN]);

    public static getInstances() {
        return XiciDailiProducer.config.producers.xiciDaili.instances
            .map((instance: any) => new Instance(instance.host, instance.port, instance.protocol, instance.path));
    }

    constructor(host?: string, port?: number, protocol = "https", options?: IProducerConstructOptions) {
        super(host, port, protocol, {
            ...options,
            userAgent: XiciDailiProducer.config.producers.xiciDaili.userAgent,
        });
    }

    public async fetchProxyList(length: number, area = Area.GLOBAL, { abortSignal }: IProducerOptions = {}) {
        if (!XiciDailiProducer.areas.has(area)) {
            return [];
        }

        const entries: string[][] = await this.executeInBrowser(() =>
            Array.prototype.slice.call(document.querySelectorAll("#ip_list tbody tr"), 1)
                .map((tr) => Array.prototype.map.call(tr.querySelectorAll("td"), (td, i) => {
                    if (i === 6 || i === 7) {
                        return td.querySelector("div").getAttribute("title");
                    }

                    return td.innerText.trim();
                })), area, { abortSignal });

        return entries.map((entry: string[]) => {
            const proxies = [];
            const newProxy = new Proxy(entry[1], "http", parseInt(entry[2], 10), area);

            newProxy.historyResponseTime.push(parseFloat(entry[7]) * 1000);
            proxies.push(newProxy);

            if (entry[5].toLowerCase() === "https") {
                const httpsProxy = new Proxy(entry[1], "https", parseInt(entry[2], 10), area);

                httpsProxy.historyResponseTime.push(parseFloat(entry[7]) * 1000);
                proxies.push(httpsProxy);
            }

            return proxies;
        }).flat().slice(0, length);
    }
}
