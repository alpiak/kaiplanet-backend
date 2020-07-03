import IProducer from "../IProducer";
import IProducerConstructOptions from "../IProducerConstructOptions";
import IProducerOptions from "../IProducerMethodOptions";

import Area from "../Area";
import Instance from "../Instance";
import Producer from "../Producer";
import Proxy from "../Proxy";

export default class IpHaiProducer extends Producer implements IProducer {
    public static get instances() {
        return IpHaiProducer.config.producers.ipHai.instances
            .map((instance: any) => new Instance(instance.host, instance.port, instance.protocol, instance.path));
    }

    public static areas = new Set([Area.CN]);

    constructor(host?: string, port?: number, protocol = "https", options?: IProducerConstructOptions) {
        super(host, port, protocol, {
            ...options,
            userAgent: IpHaiProducer.config.producers.ipHai.userAgent,
        });
    }

    public async fetchProxyList(length: number, area = Area.GLOBAL, { abortSignal }: IProducerOptions=  {}) {
        if (!IpHaiProducer.areas.has(area)) {
            return [];
        }

        const entries: string[][] = await this.executeInBrowser(() =>
            Array.prototype.slice.call(document.querySelectorAll("table tbody tr"), 1)
                .map((tr) => Array.prototype.map.call(tr.querySelectorAll("td"), (td) => td.innerText.trim())), area, {
                    abortSignal,
                });

        return entries.map((entry: string[]) => {
            const proxies = [];
            const newProxy = new Proxy(entry[0], "http", parseInt(entry[1], 10), area);

            newProxy.historyResponseTime.push(parseFloat(entry[5]) * 1000);
            proxies.push(newProxy);

            if (entry[3].toLowerCase() === "https") {
                const httpsProxy = new Proxy(entry[0], "https", parseInt(entry[1], 0), area);

                httpsProxy.historyResponseTime.push(parseFloat(entry[5]) * 1000);
                proxies.push(httpsProxy);
            }

            return proxies;
        }).flat().slice(0, length);
    }
}
