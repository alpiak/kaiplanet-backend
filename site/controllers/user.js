/**
 * Created by qhyang on 2017/8/16.
 */

const express = require('express');

const User = require('../models/users');

module.exports = {
    registerRoutes: function(app) {
        app.post('/user/info', this.getUserInfo);
        app.post('/user/logout', this.logOut);
    },


    getUserInfo: function (req, res, next) {
        if (!req.user) {
            return res.json({
                status: -1,
                discription:  'Session Invalid'
            });
        }
        User.findById(req.user._id, function (err, user) {
            if (err) {
                return next();
            }
            return res.json({
                status: 1,
                data: user
            });
        });
    },
    logOut: function (req, res) {
        req.logout();
        return res.status(200).end();
    }
};
