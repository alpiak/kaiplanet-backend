/**
 * Created by qhyang on 2017/5/17.
 */

const passport = require('passport'),
    BaiduStrategy = require('passport-baidu').Strategy;

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

const User = require("../models/UserModel");

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        if (err || !user) return done(err, null);
        done(err, user);
    });
});

module.exports = function (options) {
    if (!options.successRedirect) {
        options.successRedirect = require('../config').basePath + '/home';
    }
    if (!options.failureRedirect) {
        options.failureRedirect = require('../config').basePath + '/home';
    }

    return {
        init: function(app) {
            const kaiPlanetConnection = require("../db").kaiPlanetConnection;

            app.use(require('express-session')({
                secret: require('../credentials').default.cookieSecret,
                resave: true,
                saveUninitialized: false,
                cookie: { maxAge: 2628000000 },
                store: new (require('express-sessions'))({
                    storage: 'mongodb',
                    instance: kaiPlanetConnection,
                    expire: 86400
                })
            }));

            const env = app.get('env'),
                config = options.providers;

            passport.use(new BaiduStrategy({
                clientID: config.baidu[env].appId,
                clientSecret: config.baidu[env].appSecret,
                callbackURL: '/auth/baidu/callback'
            }, function(accessToken, refreshToken, profile, done) {
                const User = require("../models/UserModel");

                User.findOrCreate({ baiduId: profile.id }, {
                    nickName: profile.displayName || profile.username,
                    birthday: profile.birthday || '',
                    gender: (() => {
                        switch (profile.gender) {
                            case '0':
                                return 0;
                            case '1':
                                return 1;
                            case '2':
                                return 2;
                            default:
                                return 0;
                        }
                    })(),
                    gridStackData: '[{"x":0,"y":0,"width":12,"height":2,"type":"header","zIndex":3}'
                }, function (err, user) {
                    user.lastLogin =  Date.now();
                    user.save();
                    return done(err, user);
                });
            }));

            app.use(passport.initialize());
            app.use(passport.session());
        },

        registerRoutes: function(app) {
            app.get('/auth/baidu', function (req, res, next) {
                passport.authenticate('baidu', {
                    callbackURL: '/auth/baidu/callback' + (req.query.redirect ? "?redirect=" + encodeURIComponent(req.query.redirect): '')
                })(req, res, next);
            });

            app.get('/auth/baidu/callback', passport.authenticate('baidu', { failureRedirect: require('../config').basePath + '/home' }), function(req, res) {
                // If this function gets called, authentication was successful.
                // `req.user` contains the authenticated user.
                //TODO: console.log(req.user);
                res.redirect(303, req.query.redirect || options.successRedirect);
            });
        }
    };
};
