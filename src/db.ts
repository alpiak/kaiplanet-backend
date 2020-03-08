/**
 * Created by qhyang on 2017/5/2.
 */

import * as express from "express";
import * as mongoose from "mongoose";

import credentials from "./credentials";

// @ts-ignore
mongoose.Promise = Promise;

const app = express();

const opts = {
    server: {
        socketOptions: { keepAlive: 1 },
    },
};

const kaiPlanetConnection = (() => {
    switch (app.get("env")) {
        case "development":
            return mongoose.connect(credentials.mongo.bubblesoft.development.connectionString, opts);

        case "production":
            return mongoose.connect(credentials.mongo.bubblesoft.production.connectionString, opts);

        default:
            throw new Error("Unknown execution environment: " + app.get("env"));
    }
})();

export { kaiPlanetConnection };
