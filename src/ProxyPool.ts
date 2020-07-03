// @ts-ignore
import ProxyService from "./services/ProxyService/index";

export default class ProxyPool {
    private readonly proxyService: ProxyService;

    constructor({ proxyService }: { proxyService: ProxyService }) {
        this.proxyService = proxyService;
    }

    public getProxyList(areaCode: string, protocol?: string) {
        return this.proxyService.getProxyList(areaCode, protocol);
    }

    // TODO: remove this function after related code updated
    public getRandomProxy(areaCode: string) {
        const proxies = this.getProxyList(areaCode);

        if (!proxies) {
            return;
        }

        return proxies.slice(0, ProxyService.MAX_PROXY_NUM)[Math.floor(proxies.length * Math.random())];
    }

    public getRandomProxies(areaCode = "GLOBAL", protocol = "all", num = 1, range = .5) {
        const proxies = this.getProxyList(areaCode, protocol);

        if (!proxies) {
            return;
        }

        if (proxies.length <= num) {
            return proxies;
        }

        const rangedProxies = proxies.slice(0, Math.ceil(proxies.length * range));

        if (rangedProxies.length <= num) {
            return rangedProxies;
        }

        return rangedProxies.slice(0, num);
    }
}
