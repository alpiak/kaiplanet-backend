/**
 * Created by qhyang on 2017/7/25.
 */

const mongoose = require("mongoose"),
    userSchema = new mongoose.Schema({
        baiduId: { type: String, unique: true },
        nickName: String,
        gender: Number,
        birthday: Date,
        gridStackData: String,
        lastLogin: Date
    }),
    autoIncrement = require("mongoose-auto-increment"),
    findOrCreate = require("mongoose-findorcreate"),
    kaiPlanetConnection = require("../db").kaiPlanetConnection;

autoIncrement.initialize(kaiPlanetConnection);

userSchema.plugin(autoIncrement.plugin, { model: "UserModel", field: "userId" });
userSchema.plugin(findOrCreate);

let UserModel = kaiPlanetConnection.model("UserModel", userSchema);

module.exports = UserModel;
