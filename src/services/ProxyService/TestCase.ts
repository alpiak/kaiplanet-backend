import Area from "./Area";

import { request } from "../../libraries/utils";

export default class TestCase {
    private static FAILURE_TIMES_TO_MARK_AS_INVALID = 3;

    get originResponse() {
        return this.privateOriginResponse;
    }

    public valid = false;

    public readonly url: string;
    public readonly method: string;
    public readonly areas = new Set();
    private privateOriginResponse = Buffer.from("");
    private failureTimes = 0;

    constructor(url: string, method = "GET", areas = [Area.GLOBAL]) {
        this.url = url;
        this.method = method;

        if (Array.isArray(areas)) {
            this.areas = new Set(areas);
        } else {
            this.areas = new Set([areas]);
        }
    }

    public async refreshOriginResponse() {
        this.privateOriginResponse = await new Promise(async (resolve, reject) => {
            try {
                const url = new URL(this.url);

                try {
                    const res = await request({
                        hostname: url.host || url.hostname,
                        method: this.method,
                        path: url.pathname + url.search,
                        protocol: url.protocol && url.protocol.length ? url.protocol.replace(/:\S*$/, "") : "https",
                    });

                    if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                        this.failureTimes++;

                        reject();

                        return;
                    }

                    this.failureTimes = 0;
                    this.valid = true;

                    let data = Buffer.from("");

                    res.on("data", (chunk) => {
                        data = Buffer.concat([data, chunk]);
                    });

                    res.on("end", () => {
                        resolve(data);
                    });
                } catch (e) {
                    this.failureTimes++;

                    if (this.failureTimes >= TestCase.FAILURE_TIMES_TO_MARK_AS_INVALID) {
                        this.valid = false;
                    }

                    reject(e);
                }
            } catch (e) {
                this.failureTimes++;

                if (this.failureTimes >= TestCase.FAILURE_TIMES_TO_MARK_AS_INVALID) {
                    this.valid = false;
                }

                reject(e);
            }
        });
    }
}
