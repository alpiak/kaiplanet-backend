import Area from "./Area";

export default class Proxy {
    private static HISTORY_RECORDS_LIMIT = 32;
    public readonly host: string;
    public readonly protocol: string;
    public readonly port: number;
    public readonly area: Area;
    public readonly historyResponseTime: number[] = [];
    public readonly historySpeed: number[] = [];
    public failureTimes = 0;

    constructor(host: string, protocol: string, port: number, area = Area.GLOBAL) {
        this.host = host;
        this.protocol = protocol;
        this.port = port;
        this.area = area;
    }

    public recordResponseTime(responseTime: number) {
        if (this.historyResponseTime.length >= Proxy.HISTORY_RECORDS_LIMIT) {
            this.historyResponseTime.shift();
        }

        this.historyResponseTime.push(responseTime);
    }

    public recordSpeed(speed: number) {
        if (this.historySpeed.length >= Proxy.HISTORY_RECORDS_LIMIT) {
            this.historySpeed.shift();
        }

        this.historySpeed.push(speed);
    }

    public equals(proxy: Proxy) {
        return this.host === proxy.host
            && this.protocol === proxy.protocol
            && this.port === proxy.port
            && this.area === proxy.area;
    }

    public toString() {
        return `${this.protocol}://${this.host}:${this.port}`;
    }
}
