/**
 * Created by qhyang on 2017/4/20.
 */

import * as Bluebird from "bluebird";
import * as bodyParser from "body-parser";
import * as express from "express";
import * as fs from "fs";

import "abortcontroller-polyfill/dist/abortcontroller-polyfill-only";
import * as compression from "compression";

// @ts-ignore
import * as any from "promise.any";

import credentials from "./credentials";

any.shim();

// @ts-ignore
import * as getProxyService from "./services/ProxyService";
const ProxyService = getProxyService(process.env.NODE_ENV);
import AudioSourceService from "./services/AudioSourceService";
// @ts-ignore
import * as getCacheService from "./services/CacheService";
const CacheService = getCacheService(process.env.NODE_ENV);
// @ts-ignore
import * as getLocationService from "./services/LocationService";
const LocationService = getLocationService(process.env.NODE_ENV);
import ShorteningService from "./services/ShorteningService";

// @ts-ignore
import * as getAuth from "./controllers/auth";
const auth = getAuth({
    failureRedirect: require("./config").basePath,
    providers: credentials.authProviders,
    successRedirect: require("./config").basePath,
});
// @ts-ignore
import * as getAudioController from "./controllers/AudioController";
const AudioController = getAudioController({ AudioSourceService });
// @ts-ignore
import * as getProxyController from "./controllers/ProxyController";
const ProxyController = getProxyController(process.env.NODE_ENV);
import ShortenController from "./controllers/ShortenController";
// @ts-ignore
import * as timeController from "./controllers/time";
// @ts-ignore
import * as userController from "./controllers/user";
// @ts-ignore
import * as weatherController from "./controllers/weather";

Bluebird.promisifyAll(fs);

const app = express();

app.set("port", process.env.PORT || 3000);

auth.init(app);
auth.registerRoutes(app);

const proxyService = new ProxyService();
const cacheService = new CacheService();
const audioSourceService = new AudioSourceService();
const locationService = new LocationService();
const shorteningService = new ShorteningService();

audioSourceService.cacheService = cacheService;
audioSourceService.locationService = locationService;

const proxyPool = {
    getProxyList(areaCode: string, protocol?: string) {
        return proxyService.getProxyList(areaCode, protocol);
    },

    // TODO: remove this function after related code updated
    getRandomProxy(areaCode: string) {
        const proxies = this.getProxyList(areaCode).slice(0, ProxyService.MAX_PROXY_NUM);

        return proxies[Math.floor(proxies.length * Math.random())];
    },

    getRandomProxies(areaCode = "GLOBAL", protocol = "all", num = 1, range = .5) {
        const proxies = this.getProxyList(areaCode, protocol);

        if (proxies.length <= num) {
            return proxies;
        }

        const rangedProxies = proxies.slice(0, Math.ceil(proxies.length * range));

        if (rangedProxies.length <= num) {
            return rangedProxies;
        }

        return rangedProxies.slice(0, num);
    },
};

audioSourceService.proxyPool = proxyPool;

const proxyController = new ProxyController();
const audioController = new AudioController();
const shortenController = new ShortenController(shorteningService);

proxyController.proxyService = proxyService;
proxyController.proxyPool = proxyPool;
proxyController.cacheService = cacheService;
proxyController.locationService = locationService;
audioController.audioSourceService = audioSourceService;
audioController.proxyService = proxyService;

proxyController.registerProxyRoutes(app);

app.use(bodyParser.json());

proxyController.registerRoutes(app);
userController.registerRoutes(app);
timeController.registerRoutes(app);
weatherController.registerRoutes(app);
audioController.registerRoutes(app);
shortenController.registerRoutes(app);

// Static views

const autoViews = new Map();

app.use((req, res, next) => {
    (async () => {
        const path = req.path.toLowerCase();

        if (autoViews.has(path)) {
            return res.send(autoViews.get(path));
        }

        if (fs.existsSync(__dirname + "/views" + path + ".html")) {
            // @ts-ignore
            autoViews.set(path, await fs.readFileAsync(__dirname + "/views" + path + ".html", "utf8"));

            return res.send(autoViews.get(path));
        }

        next();
    })();
});

// Static resources
app.use(compression());
app.use(express.static(__dirname + "/public"));

// 404 page
app.use((req, res) => {
    res.type("text/plain");
    res.status(404);
    res.send("404 - Not Found");
});

// 500 page
app.use((err, req, res) => {
    // @ts-ignore
    console.error(err.stack); // tslint:disable-line
    // @ts-ignore
    res.type("text/plain");
    // @ts-ignore
    res.status(500);
    // @ts-ignore
    res.send("500 - Server Error");
});

app.listen(app.get("port"), () => {
    console.log( "Express started on http://localhost:" + app.get("port") + "; press Ctrl-C to terminate." ); // tslint:disable-line
});
