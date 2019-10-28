const http = require("http");
const https = require("https");
const url = require("url");
const zlib = require("zlib");
const { Transform } = require("stream");
const dns = require("dns");

const ProxyAgent = require("proxy-agent");
const { pipe } = require("mississippi");

const REQUEST_TIMEOUT = 1000 * 60 * 2;
const REF_REGEXP = '(?:href|src|action)="\\s*((?:\\S|\\s)+?)"';
const ONLY_PATH_REGEXP = '(?:^\\/$|^\\/[^\\/]|^[^\\/]*$)';
const NO_PROTOCOL_REGEXP = '^\\/{2,}';
const HEAD_START_REGEXP = '<html(?:\\S|\\s)*?>\\s*?<head(?:\\S|\\s)*?>';

class TransformHtml extends Transform {
    constructor(options) {
        super(options);

        this.lastChunk = '';

        if (options) {
            const { protocol, host, path, proxyBaseUrl } = options;

            this.protocol = protocol;
            this.host = host;
            this.path = path;
            this.proxyBaseUrl = proxyBaseUrl;
        }
    }

    _transform(currentChunk, encoding, end) {
        if (this.lastChunk.length === 0) {
            this.lastChunk = currentChunk;

            return end();
        }

        const PROXIED_REGEXP = `^${this.proxyBaseUrl.replace(/\//g, '\\/')}`;

        const lastChunkLength = this.lastChunk.length;
        const refRegExp = new RegExp(REF_REGEXP, 'g');
        const noProtocolRegExp = new RegExp(NO_PROTOCOL_REGEXP);

        let chunk = this.lastChunk + currentChunk.toString('utf8');

        while (true) {
            const result = refRegExp.exec(chunk);

            if (result && result[1] && !new RegExp(PROXIED_REGEXP).test(result[1])) {
                let fixedUrl = result[1];

                if (new RegExp(ONLY_PATH_REGEXP).exec(fixedUrl)) {
                    if (!/^\//.test(fixedUrl)) {
                        fixedUrl = `${this.path}/${fixedUrl}`;
                    }

                    fixedUrl = `${this.protocol}//${this.host}` + fixedUrl;
                }

                if (noProtocolRegExp.exec(result[1])) {
                    fixedUrl = fixedUrl.replace(noProtocolRegExp,  `${this.protocol}//`);
                }

                fixedUrl = fixedUrl.replace(/^\/+/, '');
                fixedUrl = this.proxyBaseUrl + fixedUrl;

                chunk = chunk.slice(0, result.index) + result[0].replace(result[1], fixedUrl) +
                    chunk.slice(result.index + result[0].length);

                refRegExp.lastIndex += fixedUrl.length - result[1].length;

                continue;
            }

            break;
        }

        const headStartResult = new RegExp(HEAD_START_REGEXP).exec(chunk);

        if (headStartResult) {
            chunk = chunk.slice(0, headStartResult.index + headStartResult[0].length) + `<!---->
                <script type="text/javascript">
                    (function() {
                        
                        
                        function fixUrl(url) {
                            if(/${PROXIED_REGEXP}/.test(url) || url === 'about:blank') {
                                return url;
                            }
                            
                            var fixedUrl = url;
                            
                            fixedUrl = fixedUrl.replace(/${NO_PROTOCOL_REGEXP}/, '${this.protocol}//');
                            fixedUrl = fixedUrl.replace(new RegExp('^' + location.origin), '');

                            if (/${ONLY_PATH_REGEXP}/.test(fixedUrl)) {
                                fixedUrl = '${this.protocol}//${this.host}' + fixedUrl;
                            }

                            if (/^(?:http:|https:)/.test(fixedUrl)) {
                                fixedUrl = '${this.proxyBaseUrl}' + fixedUrl;   
                            }
                            
                            return fixedUrl;
                        }
                        
                        function proxyMethod(object, methodName, getProxy) {
                            var originMethod = object[methodName];
                            
                            object[methodName] = getProxy(originMethod);
                        };
                        
                        proxyMethod(XMLHttpRequest.prototype, 'open', function(originMethod) {
                            return function() {
                                arguments[1] = fixUrl(arguments[1]);
                                
                                return originMethod.apply(this, arguments);
                            }
                        });
                        
                        proxyMethod(window, 'fetch', function(originMethod) {
                            return function() {
                                arguments[0] = fixUrl(arguments[0]);
                                
                                return originMethod.apply(this, arguments);
                            }
                        });
                        
                        function getHTMLElementMethodProxy(originMethod) {
                            function fixRef(element) {
                                if (element && typeof element.href === 'string') {
                                    element.href = fixUrl(element.href);
                                }
                               
                                if (element && typeof element.src === 'string') {
                                    element.src = fixUrl(element.src);
                                }
                                
                                var childNodes = element.childNodes;
                                
                                if (childNodes) {
                                    var i, len;
                                    
                                    for (i = 0, len = childNodes.length; i < len; i++) {
                                        if (childNodes[i].nodeType === 1) {
                                            fixRef(childNodes[i]);
                                        }
                                    }
                                }
                            }
                            
                            return function() {
                                fixRef(arguments[0]);
                               
                                return originMethod.apply(this, arguments);
                            }
                        }
                        
                        proxyMethod(HTMLElement.prototype, 'appendChild', getHTMLElementMethodProxy);
                        proxyMethod(HTMLElement.prototype, 'insertBefore', getHTMLElementMethodProxy);
                        
                        var href = location.href;
                        
                        window.addEventListener('load', function() {
                            history.replaceState(null, null, href);
                            
                            var anchors = document.getElementsByTagName('a');
                            var i, len;
                            
                            for (i = 0, len = anchors.length; i < len; i++) {
                                anchors[i].href = fixUrl(anchors[i].href);
                            }
                        });
                    })()
                </script>
            ` + chunk.slice(headStartResult.index + headStartResult[0].length);
        }

        this.push(chunk.slice(0, lastChunkLength));
        this.lastChunk = chunk.slice(lastChunkLength);

        end();
    }

    _flush(end) {
        this.push(this.lastChunk);

        end();
    }
}

module.exports = ({ proxyPool, cacheService, locationService }) => async (req, res, next) => {
    try {
        if (!/\./.test(req.url) && !/:/.test(req.url)) {
            return next();
        }

        const fixedUrl = ((url) => {
            if (!/:/.test(url)) {
                return 'https://' + url;
            }

            return url;
        })(req.url.replace(/^\/+/, '').replace(/\/+$/, ''));

        const targetUrl = url.parse(fixedUrl);

        const reqHeaders = {
            ...req.headers,
            'host': `${targetUrl.host}${(targetUrl.port && (':' + targetUrl.port)) || ''}`,
            'origin': `${targetUrl.protocol}//${targetUrl.host}${(targetUrl.port && (':' + targetUrl.port)) || ''}`,
            'referer': `${targetUrl.protocol}//${targetUrl.host}${(targetUrl.port && (':' + targetUrl.port)) || ''}/`,
        };

        let raceEnded = false;

        const originRes = await (async () => {
            if (cacheService.exists(targetUrl.href)) {
                return cacheService.get(targetUrl.href);
            }

            let proxies;
            let failCount = 0;

            const sendRequest = (proxy) => new Promise((resolve, reject) => {
                const client = targetUrl.protocol === 'https:' ? https : http;

                if ((!zlib.createBrotliDecompress || !zlib.createBrotliCompress) && reqHeaders["accept-encoding"]) {
                    reqHeaders['accept-encoding'] = reqHeaders['accept-encoding']
                        .split(',')
                        .filter((encoding) => !/br/.test(encoding))
                        .join(',');
                }

                const options = {
                    method: req.method,
                    protocol: targetUrl.protocol,
                    host: targetUrl.host,
                    port: targetUrl.port,
                    path: targetUrl.path,
                    headers: reqHeaders,
                    rejectUnauthorized: false
                };

                if (proxy) {
                    options.agent = new ProxyAgent(proxy);
                }

                const targetReq = client.request(options, (res) => {
                    resolve(res);

                    if (raceEnded) {
                        targetReq.abort();
                    }
                });

                targetReq.on("error", (e) => {
                    failCount++;

                    if (!proxies || failCount >= proxies.length + 1) {
                        reject(e);
                    }
                });

                targetReq.setTimeout(REQUEST_TIMEOUT, () => {
                    failCount++;

                    if (!proxies || failCount >= proxies.length + 1) {
                        reject(new Error("Request timeout."));
                        targetReq.abort();
                    }
                });

                req.pipe(targetReq);
            });

            return await Promise.race([sendRequest(), Promise.race(await (async () => {
                proxies = await (async (url) => {
                    try {
                        const ip = await new Promise((resolve, reject) => {
                            dns.lookup(url.host, (err, address) => {
                                if (err) {
                                    reject(err);
                                }

                                resolve(address);
                            });
                        });

                        const location = await locationService.getLocation(ip);

                        return proxyPool.getRandomProxies(location.areaCode, "all", 3, .5);
                    } catch (e) {
                        console.log(e);

                        return [];
                    }
                })(targetUrl);

                return proxies.map(sendRequest);
            })())]);
        })();

        raceEnded = true;

        if (!cacheService.exists(targetUrl.href) && originRes.statusCode >= 200 && originRes.statusCode < 300) {
            if (!req.headers["range"]) {
                (async () => {
                    try {
                        await cacheService.cache(targetUrl.href, originRes);
                    } catch (e) {
                        console.log(e);
                    }
                })();
            } else {
                const cacheReqHeaders = { ...reqHeaders };

                delete cacheReqHeaders["range"];

                (async () => {
                    try {
                        await cacheService.cache(targetUrl.href, await cacheService.sendRequest(targetUrl, req.method, { headers: cacheReqHeaders }));
                    } catch (e) {
                        console.log(e);
                    }
                })();
            }
        }

        if (originRes.statusCode >= 300 && originRes.statusCode < 400 && originRes.headers.location) {
            originRes.headers.location = `${req.protocol}://${req.headers.host}/proxy/` + originRes.headers.location;
        }

        res.status(originRes.statusCode);

        for (const [key, value] of Object.entries(originRes.headers)) {
            res.set(key, value);
        }

        const encoded = /(?:gzip|br)/.test(originRes.headers['content-encoding']);
        const isHtml = /text\/html/.test(originRes.headers['content-type']);

        if (encoded && isHtml) {
            res.removeHeader('content-length');


            const decoder = ((encoding) => {
                switch (encoding) {
                    case 'br':
                        return zlib.createBrotliDecompress && zlib.createBrotliDecompress();
                    case 'gzip':
                    default:
                        return zlib.createGunzip();
                }
            })(originRes.headers['content-encoding']);

            const encoder = ((encoding) => {
                switch (encoding) {
                    case 'br':
                        return zlib.createBrotliCompress && zlib.createBrotliCompress();
                    case 'gzip':
                    default:
                        return zlib.createGzip();
                }
            })(originRes.headers['content-encoding']);

            if (decoder && encoder) {
                pipe(originRes, decoder, new TransformHtml({
                    host: targetUrl.host,
                    protocol: targetUrl.protocol,
                    path: targetUrl.path,
                    proxyBaseUrl: `${req.headers['origin'] || (req.protocol + '://' + req.headers['host'])}/proxy/`,
                }), encoder, res, (err) => {
                    if (err) {
                        return next(err);
                    }
                });
            } else {
                pipe(originRes, res, (err) => {
                    if (err) {
                        return next(err);
                    }
                });
            }
        } else if (isHtml) {
            res.removeHeader("content-length");

            pipe(originRes, new TransformHtml({
                host: targetUrl.host,
                protocol: targetUrl.protocol,
                path: targetUrl.path,
                proxyBaseUrl: `${req.headers["origin"] || (req.protocol + "://" + req.headers["host"])}/proxy/`,
            }), res, (err) => {
                if (err) {
                    return next(err);
                }
            });
        } else {
            pipe(originRes, res, (err) => {
                if (err) {
                    return next(err);
                }
            });
        }
    } catch (err) {
        next(err);
    }
};
