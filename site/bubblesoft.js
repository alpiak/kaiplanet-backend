/**
 * Created by qhyang on 2017/4/20.
 */

const fs = require('fs'),
    Promise = require('bluebird'),
    express = require('express'),
    bodyParser = require('body-parser');

Promise.promisifyAll(fs);

const credentials = require('./credentials');

const app = express();

app.set('port', process.env.PORT || 3000);

const auth = require("./controllers/auth")(app, {
    providers: credentials.authProviders,
    successRedirect: require('./config').basePath,
    failureRedirect: require('./config').basePath,
});
auth.init();
auth.registerRoutes();

require('./controllers/proxy').registerProxyRoutes(app);

app.use(bodyParser.json());

require('./controllers/proxy').registerRoutes(app);
require('./controllers/user').registerRoutes(app);
require('./controllers/time').registerRoutes(app);
require('./controllers/weather').registerRoutes(app);
require('./controllers/audio').registerRoutes(app);

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
