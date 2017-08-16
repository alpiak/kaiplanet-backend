/**
 * Created by qhyang on 2017/7/25.
 */

const mongoose = require('mongoose'),
    userSchema = new mongoose.Schema({
        baiduId: { type: String, unique: true },
        nickName: String,
        birthday: Date
    }),
    autoIncrement = require('mongoose-auto-increment'),
    findOrCreate = require('mongoose-findorcreate'),
    bubblesoftConnection = require('../db').bubblesoftConnection;

autoIncrement.initialize(bubblesoftConnection);

userSchema.plugin(autoIncrement.plugin, { model: 'User', field: 'userId' });
userSchema.plugin(findOrCreate);

let User = bubblesoftConnection.model('User', userSchema);

module.exports = User;
