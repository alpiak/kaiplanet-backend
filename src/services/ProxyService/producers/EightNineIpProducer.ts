import IProducer from "../IProducer";
import IProducerConstructOptions from "../IProducerConstructOptions";
import IProducerMethodOptions from "../IProducerMethodOptions";

import Area from "../Area";
import Instance from "../Instance";
import Producer from "../Producer";
import Proxy from "../Proxy";

export default class EightNineIpProducer extends Producer implements IProducer {
    public static get instances() {
        return EightNineIpProducer.config.producers.eightNineIp.instances
            .map((instance: any) => new Instance(instance.host, instance.port, instance.protocol, instance.path));
    }

    public static areas = new Set([Area.CN]);

    constructor(host?: string, port?: number, protocol = "https", options?: IProducerConstructOptions) {
        super(host, port, protocol, {
            ...options,
            userAgent: EightNineIpProducer.config.producers.eightNineIp.userAgent,
        });
    }

    public async fetchProxyList(length: number, area = Area.GLOBAL, { abortSignal }: IProducerMethodOptions = {}) {
        if (!EightNineIpProducer.areas.has(area)) {
            return [];
        }

        const entries: string[][] = await this.executeInBrowser(() =>
            Array.prototype.slice.call(document.querySelectorAll(".fly-panel table tbody tr"))
                .map((tr) => Array.prototype.map.call(tr.querySelectorAll("td"), (td) => td.innerText.trim())), area, {
                    abortSignal,
                });

        return entries.map((entry: string[]) => {
            const proxies = [];
            const newProxy = new Proxy(entry[0], "http", parseInt(entry[1], 10), area);

            proxies.push(newProxy);

            const newHttpsProxy = new Proxy(entry[0], "https", parseInt(entry[1], 10), area);

            proxies.push(newHttpsProxy);

            return proxies;
        }).flat().slice(0, length);
    }
}
