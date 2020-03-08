import { Schema } from "mongoose";

// @ts-ignore
import * as createOrUpdate from "mongoose-create-or-update";

// @ts-ignore
import { kaiPlanetConnection } from "../db";

const schema = new Schema({
    data: {
        required: true,
        type: String,
    },
    key: {
        required: true,
        type: String,
        unique: true,
    },
    updatedAt: Date,
});

schema.plugin(createOrUpdate);

export default class ShortenedDataRecordModel {
    public static getInstance() {
        // @ts-ignore
        return kaiPlanetConnection.model("ShortenedDataRecord", ShortenedDataRecordModel.schema);
    }

    private static schema = schema;

    private constructor() { }
}
