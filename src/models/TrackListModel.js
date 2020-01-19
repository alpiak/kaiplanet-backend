const { Schema } = require("mongoose");
const createOrUpdate = require("mongoose-create-or-update");

const kaiPlanetConnection = require("../db").kaiPlanetConnection;

const schema = new Schema({
    id: {
        type: String,
        required: true,
    },
    sourceId: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    tracks: [{
        id: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        duration: Number,
        artists: [{
            name: String,
        }],
        picture: String,
        playbackSources: [{
            urls: [String],
            quality: {
                type: Number,
                min: 0,
                max: 1,
            },
            statical: Boolean,
        }],
    }],
    updatedOn: Date,
});

schema.index({ sourceId: 1, id: 1 });
schema.plugin(createOrUpdate);

module.exports = kaiPlanetConnection.model("TrackList", schema);
