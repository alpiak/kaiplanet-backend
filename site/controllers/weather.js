/**
 * Created by qhyang on 2017/4/27.
 */

const express = require('express');
const proxy = require('http-proxy-middleware');

// proxy middleware options
let options = {
    target: 'https://api.darksky.net', // Target host
    changeOrigin: true, // Needed for virtual hosted sites
    pathRewrite: {
        '^/weather' : '/forecast/' + require("../credentials").darkSkyKey + "/" // Add base path
    }
};

module.exports = {
    registerRoutes: function(app) {
        app.use('/weather', this.darkSkyProxy);
    },

    // create the proxy (without context)
    darkSkyProxy: proxy(options)

};
