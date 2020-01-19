/**
 * Created by qhyang on 2017/4/20.
 */

const fs = require('fs');
const Promise = require('bluebird');
const express = require('express');
const bodyParser = require('body-parser');

require("abortcontroller-polyfill/dist/abortcontroller-polyfill-only");

Promise.promisifyAll(fs);

const credentials = require('./credentials');

const ProxyService = require("./services/ProxyService")(process.env.NODE_ENV);
const AudioSourceService = require("./services/AudioSourceService")(process.env.NODE_ENV);
const CacheService = require("./services/CacheService")(process.env.NODE_ENV);
const LocationService = require("./services/LocationService")(process.env.NODE_ENV);

const ProxyController = require('./controllers/ProxyController')();
const AudioController = require('./controllers/AudioController')({ AudioSourceService });

const app = express();

app.set('port', process.env.PORT || 3000);

const auth = require("./controllers/auth")(app, {
    providers: credentials.authProviders,
    successRedirect: require('./config').basePath,
    failureRedirect: require('./config').basePath,
});

auth.init();
auth.registerRoutes();

const proxyService = new ProxyService();
const cacheService = new CacheService();
const audioSourceService = new AudioSourceService();
const locationService = new LocationService();

audioSourceService.cacheService = cacheService;
audioSourceService.locationService = locationService;

const proxyPool = {
    getProxyList(areaCode) {
        return proxyService.getProxyList(areaCode);
    },

    // TODO: remove this function after related code updated
    getRandomProxy(areaCode) {
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
    }
};

audioSourceService.proxyPool = proxyPool;

const proxyController = new ProxyController();
const audioController = new AudioController();

proxyController.proxyService = proxyService;
proxyController.proxyPool = proxyPool;
proxyController.cacheService = cacheService;
proxyController.locationService = locationService;
audioController.audioSourceService = audioSourceService;
audioController.proxyService = proxyService;

proxyController.registerProxyRoutes(app);

app.use(bodyParser.json());

proxyController.registerRoutes(app);
require('./controllers/user').registerRoutes(app);
require('./controllers/time').registerRoutes(app);
require('./controllers/weather').registerRoutes(app);
audioController.registerRoutes(app);

// Static views

let autoViews = {};

app.use(function(req, res, next) {
    (async function () {
        const path = req.path.toLowerCase();

        if(autoViews[path]) return res.send(autoViews[path]);

        if(fs.existsSync(__dirname + '/views' + path + '.html')){
            autoViews[path] = await fs.readFileAsync(__dirname + '/views' + path + '.html', "utf8");
            return res.send(autoViews[path]);
        }

        next();
    }());
});

// Static resources
app.use(require('compression')());
app.use(express.static(__dirname + '/public'));

// 404 page
app.use(function(req, res) {
    res.type('text/plain');
    res.status(404);
    res.send('404 - Not Found');
});

// 500 page
app.use(function(err, req, res) {
    console.error(err.stack);
    res.type('text/plain');
    res.status(500);
    res.send('500 - Server Error');
});

app.listen(app.get('port'), function() {
    console.log( 'Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.' );
});
