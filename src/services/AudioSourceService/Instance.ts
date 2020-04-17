export default class {
    public readonly host: string;
    public readonly port: number;
    public readonly protocol: string;

    constructor(host: string, port: number, protocol = "https") {
        this.host = host;

        if (typeof port === "undefined") {
            this.port = protocol === "https" ? 443 : 80;
        } else {
            this.port = port;
        }

        this.protocol = protocol;
    }

    public toString() {
        return `${this.protocol}://${this.host}:${this.port}`;
    }
}
