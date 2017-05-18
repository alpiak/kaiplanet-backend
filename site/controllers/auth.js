/**
 * Created by qhyang on 2017/5/17.
 */

const express = require('express'),
    passport = require('passport'),
    BaiduStrategy = require('passport-baidu').Strategy;

module.exports = function (app, options) {
    if (!options.successRedirect) {
        options.successRedirect = '/home';
    }
    if (!options.failureRedirect) {
        options.failureRedirect = '/home';
    }

    return {
        init: function() {
            const env = app.get('env'),
                config = options.providers;

            passport.use(new BaiduStrategy({
                clientID: config.baidu[env].appId,
                clientSecret: config.baidu[env].appSecret,
                callbackURL: "/auth/baidu/callback"
            }, function(accessToken, refreshToken, profile, done) {
                // User.findOrCreate({ baiduId: profile.id }, function (err, user) {
                //     return done(err, user);
                // });
                console.log(profile.id);
            }));

            app.use(passport.initialize());
            app.use(passport.session());
        },
        registerRoutes: function() {
            app.get('/auth/baidu', passport.authenticate('baidu'));

            app.get('/auth/baidu/callback', passport.authenticate('baidu', { failureRedirect: '/home' }), function(req, res) {
                // If this function gets called, authentication was successful.
                // `req.user` contains the authenticated user.
                console.log(req.user.username);
            });
        }
    };
};
