import * as crypto from "crypto";

import * as schedule from "node-schedule";

import ShortenedDataRecordModel from "../../models/ShortenedDataRecordModel";

import { getConfig } from "./utlis";

const config = getConfig();

export default class ShorteningService {
    private static getHashCode(key: string) {
        const hash = crypto.createHash("md5");

        hash.update(key);

        return hash.digest("hex");
    }

    private model = ShortenedDataRecordModel.getInstance();
    private scheduleJobRunning = false;

    constructor() {
        schedule.scheduleJob("0 0 3 ? * 3", async () => {
            if (this.scheduleJobRunning) {
                return;
            }

            this.scheduleJobRunning = true;
            console.log("Shortening service scheduled job running."); // tslint:disable-line

            try {
                await this.removeOutdatedData();
            } catch (e) {
                // console.log(e);
            }

            this.scheduleJobRunning = false;
        });
    }

    public async shorten(data: string) {
        const key = ShorteningService.getHashCode(data);

        await this.model.createOrUpdate({ key }, { key, data, updatedAt: new Date() });

        return key;
    }

    public async match(key: string) {
        const doc = await this.model.findOneAndUpdate({ key }, { updatedAt: new Date() }).exec();

        if (!doc) {
            return null;
        }

        return doc;
    }

    private async removeOutdatedData() {
        try {
            const date = new Date();

            await this.model.deleteMany({
                updatedAt: {
                    $lt: new Date(date.getTime() - config.expiresAfter),
                },
            }).exec();
        } catch (e) {
            // console.log(e);
        }
    }
}
