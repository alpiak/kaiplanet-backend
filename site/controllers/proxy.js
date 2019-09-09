/**
 * Created by qhyang on 2018/4/27.
 */

const http = require('http');
const https = require('https');
const url = require('url');
const { Transform } = require('stream');
const zlib = require('zlib');

const _proxy = require('http-proxy-middleware');

const ProxyService = require("../services/ProxyService")(process.env.NODE_ENV);

const proxyService = new ProxyService();

module.exports = {
    registerProxyRoutes(app) {
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

        app.use('/proxy', async (req, res, next) => {
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

                const headers = {
                    ...req.headers,
                    'host': `${targetUrl.host}${(targetUrl.port && (':' + targetUrl.port)) || ''}`,
                    'origin': `${targetUrl.protocol}//${targetUrl.host}${(targetUrl.port && (':' + targetUrl.port)) || ''}`,
                    'referer': `${targetUrl.protocol}//${targetUrl.host}${(targetUrl.port && (':' + targetUrl.port)) || ''}/`,
                };

                const originRes = await new Promise((resolve, reject) => {
                    const client = targetUrl.protocol === 'https:' ? https : http;

                    if (!zlib.createBrotliDecompress || !zlib.createBrotliCompress) {
                        headers['accept-encoding'] = headers['accept-encoding']
                            .split(',')
                            .filter((encoding) => !/br/.test(encoding))
                            .join(',');
                    }

                    const targetReq = client.request({
                        method: req.method,
                        protocol: targetUrl.protocol,
                        host: targetUrl.host,
                        port: targetUrl.port,
                        path: targetUrl.path,
                        headers,
                        rejectUnauthorized: false
                    }, (res) => resolve(res));

                    targetReq.on('error', (err) => {
                        reject(err);
                    });

                    req.pipe(targetReq);
                });

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
                        originRes.pipe(decoder).pipe(new TransformHtml({
                            host: targetUrl.host,
                            protocol: targetUrl.protocol,
                            path: targetUrl.path,
                            proxyBaseUrl: `${req.headers['origin'] || (req.protocol + '://' + req.headers['host'])}/proxy/`,
                        })).pipe(encoder).pipe(res);
                    } else {
                        originRes.pipe(res);
                    }
                } else if (isHtml) {
                    res.removeHeader('content-length');

                    originRes.pipe(new TransformHtml({
                        host: targetUrl.host,
                        protocol: targetUrl.protocol,
                        path: targetUrl.path,
                        proxyBaseUrl: `${req.headers['origin'] || (req.protocol + '://' + req.headers['host'])}/proxy/`,
                    })).pipe(res);
                } else {
                    originRes.pipe(res);
                }
            } catch (err) {
                res.status(500).send(err);
            }

        });
    },

    registerRoutes(app) {
        app.use('/kaiplanet', _proxy({
            target: 'http://kaiplanet.net',
            pathRewrite: {
                '^/kaiplanet' : '/'
            },
            changeOrigin: true
        }));

        app.use('/soundcloud', (req, res, next) => {
            let location;

            https.get(`https://api.soundcloud.com${req.url}`, originRes => {
                if (originRes.statusCode > 300 && originRes.statusCode < 400 && originRes.headers.location) {
                    location = url.parse(originRes.headers.location);

                    req.originalUrl = location.path;

                    if (!location.protocol) {
                        location.protocol = 'https:';
                    }

                    if (!location.host) {
                        location.host = 'api.soundcloud.com';
                    }

                    req._targetLocation = location;
                } else {
                    req._targetLocation = {
                        protocol: 'https:',
                        host: 'api.soundcloud.com'
                    };
                }

                next();
            });
        }, (req, res) => {
            _proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res)
        });

        app.use('/netease', async (req, res, next) => {
            let redirectLocation = url.parse(`http://music.163.com${req.url}`);

            const sendReq = location => {
                const client = (protocol => {
                    switch (protocol) {
                        case 'http:':
                            return http;
                        case 'https:':
                        default:
                            return https;
                    }
                })(location.protocol);

                return new Promise(resolve => {
                    client.get(location.href, res => resolve(res));
                });
            };

            while (true) {
                const originRes = await sendReq(redirectLocation);

                if (originRes.statusCode >= 200 && originRes.statusCode < 300) {
                    const location = redirectLocation;

                    req.originalUrl = location.href;

                    if (!location.protocol) {
                        location.protocol = 'https:';
                    }

                    if (!location.host) {
                        location.host = 'm10.music.126.net';
                    }

                    req._targetLocation = location;

                    next();

                    break;
                } else if (originRes.statusCode >= 300 && originRes.statusCode < 400 && originRes.headers.location) {
                    const location = url.parse(originRes.headers.location);

                    if (!location.protocol) {
                        location.protocol = 'https:';
                    }

                    if (!location.host) {
                        location.host = 'm10.music.126.net';
                    }

                    redirectLocation = location;
                } else {
                    throw 'Fetch error';
                }
            }

        }, (req, res) => {
            _proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res);
        });

        app.use('/qq', _proxy({
            target: 'http://dl.stream.qqmusic.qq.com',
            pathRewrite: {
                '^/qq' : ''
            },
            changeOrigin: true
        }));

        app.use('/hearthis', (req, res, next) => {
            https.get(`https://hearthis.at${req.url}`, originRes => {
                if (originRes.statusCode > 300 && originRes.statusCode < 400 && originRes.headers.location) {
                    const location = url.parse(originRes.headers.location);

                    req.originalUrl = location.href;

                    if (!location.protocol) {
                        location.protocol = 'https:';
                    }

                    if (!location.host) {
                        location.host = 'hearthis.at';
                    }

                    req._targetLocation = location;
                } else {
                    req._targetLocation = {
                        protocol: 'https:',
                        host: 'stream72.hearthis.at'
                    };
                }

                next();
            });
        }, (req, res) => {
            _proxy({
                target: `${req._targetLocation.protocol}//${req._targetLocation.host}`,
                changeOrigin: true
            })(req, res);
        });

        app.post("/proxy/list", this.getProxyList);
    },


    /**
     * @api {post} /proxy/list
     *
     * @apiParam {String="GLOBAL","CN"} area="GLOBAL" The physical location of the proxy
     * @apiParam {String="https","http","all"} protocol="all" Proxy protocol
     * @apiParam {String="responseTime","speed"} sortBy="responseTime" The attribute to sort the proxy list
     */
    getProxyList(req, res) {
        try {
            res.json({
                code: 1,
                data: proxyService.getProxyList(req.body.area || "GLOBAL", req.body.protocol || "all", req.body.sortBy || "responseTime"),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message,
            });
        }
    }
};
