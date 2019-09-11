/**
 * Created by qhyang on 2017/4/20.
 */

const fs = require('fs'),
    Promise = require('bluebird'),
    express = require('express'),
    bodyParser = require('body-parser');

Promise.promisifyAll(fs);

const credentials = require('./credentials');

const ProxyService = require("./services/ProxyService")(process.env.NODE_ENV);
const AudioSourceService = require("./services/AudioSourceService")(process.env.NODE_ENV);

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
const audioSourceService = new AudioSourceService();

audioSourceService.proxyPool = {
    getProxyList(areaCode) {
        return proxyService.getProxyList(areaCode);
    },

    getRandomProxy(areaCode) {
        const proxies = this.getProxyList(areaCode).slice(0, ProxyService.PROXY_NUM_THRESHOLD);

        return proxies[Math.floor(proxies.length * Math.random())];
    }
};

const proxyController = new ProxyController();
const audioController = new AudioController();

proxyController.proxyService = proxyService;
audioController.audioSourceService = audioSourceService;
audioController.proxyService = proxyService;

proxyController.registerProxyRoutes(app);

app.use(bodyParser.json());

proxyController.registerRoutes(app);
require('./controllers/user').registerRoutes(app);
require('./controllers/time').registerRoutes(app);
require('./controllers/weather').registerRoutes(app);
audioController.registerRoutes(app, { ProxyService, AudioSourceService});

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
