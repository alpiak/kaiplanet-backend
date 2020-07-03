import * as http from "http";
import * as https from "https";

import { Request } from "express";

import * as ProxyAgent from "proxy-agent";

type ICallback = (query: object) => Promise<object>|object;

interface IResponse {
    code: number;
    data?: any;
    message?: string;
}

function generateResponse(reqBody: object, callback: ICallback): Promise<IResponse>;
function generateResponse(reqBody: object[], callback: ICallback): Promise<IResponse[]>;
function generateResponse(reqBody: object|object[], callback: ICallback): Promise<IResponse>|Promise<IResponse[]> {
    const generate = async (query: object) => {
        try {
            return {
                code: 1,
                data: await callback(query),
            };
        } catch (e) {
            return {
                code: -1,
                message: "Query Failed - " + e.message,
            };
        }
    };

    if (Array.isArray(reqBody)) {
        return Promise.all(reqBody.map(generate));
    }

    return generate(reqBody);
}

interface IRequestOptions {
    protocol: string;
    hostname: string;
    path?: string;
    port?: number;
    method?: string;
    data?: any;
    queries?: string|object;
    proxy?: string;
    abortSignal?: AbortSignal;
    parse?: true|false;
    readonly [propName: string]: string|number|object|undefined|boolean;
}

const fetchData = async (options: IRequestOptions): Promise<object|Buffer> => {
    const res = await request(options);

    return new Promise<object|Buffer>(async (resolve, reject) => {
        try {
            resolve(JSON.parse((await receiveData(res)).toString("utf8")));
        } catch (e) {
            reject(e);
        }
    });
};

const request = (options: IRequestOptions) => new Promise<http.IncomingMessage>((resolve, reject) => {
    try {
        const client = (() => {
            switch (options.protocol) {
                case "http":
                    return http;
                case "https":
                default:
                    return https;
            }
        })();

        const method = options.method || "GET";

        const dataStr = (() => {
            const data = options.data;

            if (!data) {
                return "";
            }

            if (method.toUpperCase() === "POST") {
                switch (typeof data) {
                    case "string":
                        return data;
                    case "object":
                        return JSON.stringify(data);
                    default:
                        return "";
                }
            } else if (method.toUpperCase() === "GET") {
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
        })();

        const queries = (() => {
            if (typeof options.queries === "object") {
                Object.entries(options.queries)
                    .filter((entry) => entry.reduce((total, el) => total && el, true))
                    .map((entry) => entry.join("="))
                    .join("&");
            }

            return "";
        })();

        const requestOptions: any = {
            ...options,
            path: (() => {
                if (method.toUpperCase() === "GET") {
                    return options.path + "?" + encodeURI([dataStr, queries].filter((queryStr) => queryStr).join("&"));
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

        const req = client.request(requestOptions, async (res: http.IncomingMessage) => {
            resolve(res);
        });

        if (options.abortSignal) {
            options.abortSignal.addEventListener("abort", () => {
                if (req.aborted) {
                    return;
                }

                req.abort();
            });
        }

        req.on("error", (e: Error) => {
            reject(e);
        });

        if (method.toUpperCase() === "POST") {
            req.write(dataStr);
        }

        req.end();
    } catch (e) {
        reject(e);
    }
});

const receiveData = (res: http.IncomingMessage): Promise<Buffer> => new Promise((resolve, reject) => {
    try {
        let ended = false;
        let data = Buffer.from("");

        res.on("data", (chunk) => {
            data = Buffer.concat([data, chunk]);
        });

        res.on("end", () => {
            ended = true;

            return resolve(data);
        });

        res.on("error", (err) => {
            return reject(err);
        });

        res.on("close", () => {
            if (!ended) {
                return reject(new Error("Connection closed prematurely."));
            }
        });
    } catch (e) {
        reject(e);
    }
});

const getClientIp = (req: Request) => {
    return req.headers["x-forwarded-for"]
        || req.connection.remoteAddress
        || req.socket.remoteAddress
        || req.connection.remoteAddress
        || req.ip;
};

export { IResponse, IRequestOptions, generateResponse, fetchData, request, receiveData, getClientIp };
