/**
 * Created by qhyang on 2017/5/2.
 */

const mongoose = _require('mongoose'),
    credentials = require("./credentials");

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
