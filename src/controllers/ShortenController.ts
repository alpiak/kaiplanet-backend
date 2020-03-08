import * as apicache from "apicache";
import { Express, Request, Response } from "express";

import ShorteningService from "../services/ShorteningService";

import { generateResponse } from "../libraries/utils";

const cache = apicache.middleware;

export default class {
    private shorteningService: ShorteningService;

    constructor(shorteningService: ShorteningService) {
        this.shorteningService = shorteningService;
    }

    public registerRoutes(app: Express) {
        app.post("/shorten", cache("5 minutes", () => true, {
            appendKey: (req: Request) => JSON.stringify(req.body),
        }), (req, res) => this.shorten(req, res));

        app.get("/shorten/:key", cache("5 minutes"), (req, res) => this.handleUrl(req, res));
    }

    /**
     * @api {post} /shorten
     *
     * @apiParam {String} data The string to shorten.
     */
    private async shorten(req: Request, res: Response) {
        res.json(await generateResponse(req.body, ({ data }: any) => this.shorteningService.shorten(data)));
    }

    /**
     * @api {get} /shorten/:key
     *
     * @apiParam {String} key The key to get the original data.
     */
    private async handleUrl(req: Request, res: Response) {
        const generatedResponse = await generateResponse(req.params, async ({ key }: any) => {
            const doc = await this.shorteningService.match(key);

            if (!doc) {
                throw new Error("No record matched.");
            }

            return doc.data;
        });

        if (generatedResponse.code !== 1 || !generatedResponse.data) {
            return res.status(404).json(generatedResponse);
        }

        res.redirect(301, generatedResponse.data);
    }
}
