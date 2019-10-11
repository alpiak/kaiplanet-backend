/**
 * Created by qhyang on 2018/4/27.
 */

const url = require("url");

const mime = require("mime");
const sendRanges = require("send-ranges");

module.exports = () => class {
    set proxyService(proxyService) {
        this._proxyService = proxyService;
    }

    set proxyPool(proxyPool) {
        this._proxyPool = proxyPool;
    }

    set cacheService(cacheService) {
        this._cacheService = cacheService;
    }

    set locationService(locationService) {
        this._locationService = locationService;
    }

    _proxyService;
    _proxyPool;
    _cacheService;
    _locationService;

    registerProxyRoutes(app) {
        const proxy = require("../middlewares/proxy")({
            proxyPool: this._proxyPool,
            cacheService: this._cacheService,
            locationService: this._locationService,
        });

        const retrieveStream = (req) => {
            try {
                if (!/\./.test(req.url) && !/:/.test(req.url)) {
                    return false;
                }

                const fixedUrl = ((url) => {
                    if (!/:/.test(url)) {
                        return 'https://' + url;
                    }

                    return url;
                })(req.url.replace(/^\/+/, '').replace(/\/+$/, ''));

                const targetUrl = url.parse(fixedUrl);

                if (!this._cacheService.exists(targetUrl.href)) {
                    return false;
                }

                const metadata = this._cacheService.getMetadata(targetUrl.href);
                const size = metadata.byteLength || (metadata.headers && metadata.headers["content-length"]);
                const type = (metadata.headers && metadata.headers["content-type"]) || mime.getType(targetUrl.href);
                const getStream = (range) => this._cacheService.get(targetUrl.href, range);

                return { getStream, size, metadata, type };

            } catch (err) {
                console.log(err);

                return false;
            }
        };

        const beforeSend = ({ response, metadata }, cb) => {
            for (const [key, value] of Object.entries(metadata.headers)) {
                if (key === "content-length" || key === "content-type") {
                    continue;
                }

                response.set(key, value);
            }

            cb();
        };

        app.use('/proxy', sendRanges(retrieveStream, { beforeSend }), proxy);

    }

    registerRoutes(app) {
        app.post("/proxy/list", (req, res) => this.getProxyList(req, res));
    }


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
                data: this._proxyService.getProxyList(req.body.area || "GLOBAL", req.body.protocol || "all", req.body.sortBy || "responseTime"),
            });
        } catch (e) {
            res.json({
                code: -1,
                message: 'Query Failed - ' + e.message,
            });
        }
    }
};
