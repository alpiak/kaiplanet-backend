const path = require("path");
const os = require("os");
const fs = require("fs");
const http = require("http");
const https = require("https");
const zlib = require("zlib");
const { Transform } = require("stream");

const ProxyAgent = require("proxy-agent");
const Cache = require("streaming-cache");
const cloudCache = require("cloud-cache").default;
const { pipe } = require("mississippi");
const FSBlobStore = require("fs-blob-store");

class GetContentRange extends Transform {
    _start;
    _end;
    _byteLength;

    constructor(options) {
        super(options);

        this._start = options.start || 0;
        this._end = options.end || null;
        this._byteLength = 0;
    }

    _transform(chunk, encoding, end) {
        if (this._end !== null && this._byteLength > this._end) {
            return end();
        }

        const lastByteLength = this._byteLength;
        const chunkByteLength = Buffer.byteLength(chunk);

        this._byteLength +=  chunkByteLength;

        if (this._byteLength <= this._start) {
            return end();
        }

        const chunkStart = (() => {
            if (lastByteLength < this._start) {
                return this._start - lastByteLength;
            }

            return 0;
        })();

        const chunkEnd = (() => {
            if (this._end === null || this._byteLength <= this._end + 1) {
                return chunkByteLength - 1;
            }

            return this._end - lastByteLength;
        })();

        this.push(chunk.subarray(chunkStart, chunkEnd + 1));

        end();
    }
}

class GetByteLength extends Transform {
    _callback;
    _byteLength;

    constructor(options) {
        super(options);

        this._callback = options.callback;
        this._byteLength = 0;
    }

    _transform(chunk, encoding, end) {
        this._byteLength += Buffer.byteLength(chunk);
        this.push(chunk);

        end();
    }

    _flush(end) {
        this._callback(this._byteLength);

        end();
    }
}

module.exports = (env = "development") => {
    const config = require(`./config/${env}`);

    return class CacheService {
        static CACHE_MAX_SIZE = config.cacheMaxSize;

        _cache;
        _blobCache;

        constructor() {
            this._cache = new Cache({
                max: CacheService.CACHE_MAX_SIZE,

                length: ({ metadata }) => {
                    return metadata.byteLength || 0;
                },

                dispose: (key) => {
                    try {
                        this._blobCache.del(key);
                    } catch { }
                },

                noDisposeOnSet: true,
            });

            const folder = fs.mkdtempSync(path.join(os.tmpdir(), ".cache"));
            const blobStore = FSBlobStore(folder);

            this._blobCache = cloudCache(blobStore);
        }

        async cache(key, originRes) {
            const cachePromise = new Promise((resolve, reject) => {
                let byteLength;

                pipe(originRes, new GetByteLength({
                    callback: (contentByteLength) => {
                        byteLength = contentByteLength;
                    },
                }), this._cache.set(key), (err) => {
                    if (err) {
                        reject(err);
                    }

                    resolve(byteLength);
                });
            });

            try {
                const byteLength = await cachePromise;
                const cacheStream = this._cache.get(key);

                this._cache.del(key);

                this._cache.setMetadata(key, {
                    statusCode: originRes.statusCode,
                    headers: originRes.headers,
                    byteLength: byteLength || +originRes.headers["content-length"],
                });

                pipe(cacheStream, this._blobCache.setStream(key));
            } catch (e) {
                this._cache.del(key);

                try {
                    this._blobCache.del(key);
                } catch { }

                throw e;
            }
        }

        exists(key) {
            return this._cache.exists(key);
        }

        get(key, { start, end } = {}) {
            const cacheNotExistingError = new Error(`Cache is not existing for key ${key}.`);
            const metadata = this._cache.getMetadata(key);

            if (!metadata) {
                throw cacheNotExistingError;
            }

            const { statusCode, headers } = metadata;

            try {
                const originRes = (() => {
                    if (start || end) {
                        return this._cache.get(key).pipe(new GetContentRange({ start, end }));
                    }

                    return this._cache.get(key);
                })();

                originRes.on("error", () => {
                    this._cache.del(key);

                    try {
                        this._blobCache.del(key);
                    } catch { }
                });

                originRes.statusCode = statusCode;
                originRes.headers = headers || {};

                return originRes;
            } catch {
                const originRes = (() => {
                    if (start || end) {
                        return this._blobCache.getStream(key).pipe(new GetContentRange({ start, end }));
                    }

                    return this._blobCache.getStream(key);
                })();

                originRes.on("error", () => {
                    this._cache.del(key);

                    try {
                        this._blobCache.del(key);
                    } catch { }
                });

                originRes.statusCode = statusCode;
                originRes.headers = headers || {};

                return originRes;
            }
        }

        getMetadata(key) {
            const cacheNotExistingError = new Error(`Cache is not existing for key ${key}.`);
            const metadata = this._cache.getMetadata(key);

            if (!metadata) {
                throw cacheNotExistingError;
            }

            return metadata;
        }

        sendRequest(url, method, { headers = {}, body, proxy, timeout } = {}) {
            const reqHeaders = {
                ...headers,
                'host': `${url.host}${(url.port && (':' + url.port)) || ''}`,
                'origin': `${url.protocol}//${url.host}${(url.port && (':' + url.port)) || ''}`,
                'referer': `${url.protocol}//${url.host}${(url.port && (':' + url.port)) || ''}/`,
            };

            return new Promise((resolve, reject) => {
                const client = url.protocol === 'https:' ? https : http;

                if (!zlib.createBrotliDecompress || !zlib.createBrotliCompress) {
                    reqHeaders['accept-encoding'] = reqHeaders['accept-encoding']
                        .split(',')
                        .filter((encoding) => !/br/.test(encoding))
                        .join(',');
                }

                const options = {
                    method: method,
                    protocol: url.protocol,
                    host: url.host,
                    port: url.port,
                    path: url.path,
                    headers: reqHeaders,
                    rejectUnauthorized: false
                };

                if (proxy) {
                    options.agent = new ProxyAgent(proxy);
                }

                const targetReq = client.request(options, (res) => resolve(res));

                targetReq.on("error", (err) => {
                    reject(err);
                });

                if (timeout) {
                    targetReq.setTimeout(timeout, () => {
                        reject(new Error("Request timeout."));
                        targetReq.abort();
                    });
                }

                if (body) {
                    targetReq.write(body);
                }

                targetReq.end();
            });
        }
    }
};
