/**
 * Created by qhyang on 2017/8/16.
 */

const express = require('express');

const User = require('../models/users');

module.exports = {
    registerRoutes: function(app) {
        app.post('/user/info/update', this.updateUserInfo);
        app.post('/user/info/get', this.getUserInfo);
        app.post('/user/gridstack/update', this.updateGridStackData);
        app.post('/user/gridstack/get', this.getGridStackData);
        app.post('/user/logout', this.logOut);
        app.post('/user/drawingboardimg', this.uploadDrawingBoardImage);
    },

    updateUserInfo: function (req, res, next) {
        if (!req.user) {
            return res.json({
                code: -1,
                message:  'Session Invalid'
            });
        }
        User.findById(req.user._id, function (err, user) {
            if (err) {
                return next();
            }
            Object.assign(user, {
                nickName: req.body.nickname,
                birthday: req.body.birthday,
                gender: Number(req.body.gender)
            });
            user.save((err) => {
                if (err) {
                    return res.json({
                        code: -1,
                        message: 'Update Failed - ' + error.message
                    });
                }
                res.json({
                    code: 1,
                    message: 'Update Success'
                });
            });
        });
    },
    getUserInfo: function (req, res, next) {
        if (!req.user) {
            return res.json({
                code: -1,
                message:  'Session Invalid'
            });
        }
        User.findById(req.user._id, function (err, user) {
            if (err) {
                return next();
            }
            return res.json({
                code: 1,
                data: {
                    nickName: user.nickName,
                    gender: user.gender,
                    birthday: user.birthday,
                }
            });
        });
    },
    updateGridStackData: function (req, res, next) {
        if (!req.user) {
            return res.json({
                code: -1,
                message:  'Session Invalid'
            });
        }
        User.findById(req.user._id, function (err, user) {
            if (err) {
                return next();
            }
            user.gridStackData = req.body.data;
            user.save((err) => {
                if (err) {
                    return res.json({
                        code: -1,
                        message: 'Update Failed - ' + err.message
                    });
                }
                res.json({
                    code: 1,
                    message: 'Update Success'
                });
            });
        });
    },
    getGridStackData: function (req, res, next) {
        if (!req.user) {
            return res.json({
                code: -1,
                message:  'Session Invalid'
            });
        }
        User.findById(req.user._id, function (err, user) {
            if (err) {
                return next();
            }
            return res.json({
                code: 1,
                data: user.gridStackData
            });
        });
    },
    logOut: function (req, res) {
        req.logout();
        return res.status(200).end();
    },
    uploadDrawingBoardImage: function (req, res) {
        if (!req.user) {
            return res.json({
                code: 2,
                message: 'User Not Logged In'
            });
        }

        const fileData = Buffer.from(req.body.data, 'base64');

        require('../services/file')().uploadFilesToAliyun({
            img: {
                buffer: fileData,
                name: req.user.userId + '_' + req.body.name
            }
        }, 'md5', req.body.unique).then(results => {
            res.json({
                code: 1,
                data: results
            });
        }, err => {
            res.json({
                code: -1,
                message: 'Upload Failed - ' + err.message
            });
        });
    }
};
