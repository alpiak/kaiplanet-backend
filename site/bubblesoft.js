/**
 * Created by qhyang on 2017/4/20.
 */

const express = require('express'),
    credentials = require("./credentials");

const app = express();

app.set('port', process.env.PORT || 3000);

let auth = require("./controllers/auth")(app, {
    providers: credentials.authProviders,
    successRedirect: require('./config').urlBase + '/home',
    failureRedirect: require('./config').urlBase + '/home'
});
auth.init();
auth.registerRoutes();

require('./controllers/weather').registerRoutes(app);
require('./controllers/user').registerRoutes(app);

// 404 page
app.use(function(req, res) {
    res.type('text/plain');
    res.status(404);
    res.send('404 - Not Found');
});

// 500 page
app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.type('text/plain');
    res.status(500);
    res.send('500 - Server Error');
});

app.listen(app.get('port'), function() {
    console.log( 'Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.' );
});
