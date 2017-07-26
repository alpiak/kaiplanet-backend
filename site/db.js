/**
 * Created by qhyang on 2017/5/2.
 */

const express = require('express'),
    mongoose = require('mongoose');

mongoose.Promise = Promise;

const credentials = require("./credentials");

const app = express();

let opts = {
        server: {
            socketOptions: { keepAlive: 1 }
        }
    },
    bubblesoftConnection;

switch(app.get('env')){
    case 'development':
        bubblesoftConnection = mongoose.connect(credentials.mongo.bubblesoft.development.connectionString, opts);
        break;
    case 'production':
        bubblesoftConnection = mongoose.connect(credentials.mongo.bubblesoft.production.connectionString, opts);
        break;
    default:
        throw new Error('Unknown execution environment: ' + app.get('env'));
}

module.exports = {
    bubblesoftConnection
};
