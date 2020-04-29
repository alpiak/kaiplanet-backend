import { Schema } from "mongoose";

// @ts-ignore
import * as createOrUpdate from "mongoose-create-or-update";

// @ts-ignore
import { kaiPlanetConnection } from "../db";

const schema = new Schema({
    id: {
        required: true,
        type: String,
    },
    name: {
        required: true,
        type: String,
    },
    sourceId: {
        required: true,
        type: String,
    },
    tracks: [{
        artists: [{
            name: String,
        }],
        duration: Number,
        id: {
            required: true,
            type: String,
        },
        name: {
            required: true,
            type: String,
        },
        picture: String,
        playbackSources: [{
            quality: {
                max: 1,
                min: 0,
                type: Number,
            },
            statical: Boolean,
            urls: [String],
        }],
    }],
    updatedOn: Date,
});

schema.index({ sourceId: 1, id: 1 });
schema.plugin(createOrUpdate);

// @ts-ignore
export default kaiPlanetConnection.model("TrackList", schema);
