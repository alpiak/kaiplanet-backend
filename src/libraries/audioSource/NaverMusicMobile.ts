import { parse } from "url";

import { Browser, launch, Page } from "puppeteer";

interface IOptions {
    proxy?: string;
    abortSignal?: AbortSignal;
    browserPageInstance?: Page;
}

export default class NaverMusicMobile {
    private static SEARCH_PATH = "/search/search.nhn";
    private static GET_TRACK_PATH = "/track/index.nhn";

    private readonly host: string;
    private readonly port: number;
    private readonly protocol: string;
    private readonly userAgent?: string;

    private get rootUrl() {
        return `${this.protocol}://${this.host}`;
    }

    constructor(host: string, port: number, protocol = "https", { userAgent }: { userAgent?: string } = {}) {
        this.host = host;

        if (typeof port === "undefined") {
            this.port = protocol === "https" ? 443 : 80;
        } else {
            this.port = port;
        }

        this.protocol = protocol;

        if (userAgent) {
            this.userAgent = userAgent;
        }
    }

    public async search(query: string|string[], { proxy, abortSignal }: IOptions = {}) {
        const tracks = await this.executeInBrowser(`${this.rootUrl}${NaverMusicMobile.SEARCH_PATH}?target=track&query=${([] as string[]).concat(query).map((q) => q.replace(/\s+/g, "+")).join("+")}&sort=RELEVANCE`, () => {
            return Promise.all([...document.querySelectorAll("#addList>li")].map(async (el) => ({
                id: (() => {
                    const idWrapEl = el.nextElementSibling;

                    return idWrapEl && idWrapEl instanceof HTMLInputElement && idWrapEl.value;
                })(),

                name: (() => {
                    const titleWrapEl = el.querySelector(".tit");

                    return titleWrapEl && titleWrapEl instanceof HTMLElement && titleWrapEl.innerText;
                })(),

                artists: await (async () => {
                    const subTitleWrapEl = el.querySelector(".stit");

                    if (!subTitleWrapEl || !(subTitleWrapEl instanceof HTMLElement)) {
                        return;
                    }

                    if (!/\.\./.test(subTitleWrapEl.innerText)) {
                        return subTitleWrapEl.innerText.split("-")[0].split("|").map((artist) => artist.trim());
                    }
                })(),

                img: (() => {
                    const imgWrapEl = el.querySelector(".img");

                    return imgWrapEl && imgWrapEl instanceof HTMLImageElement && imgWrapEl.src;
                })(),

                albumId: (() => {
                    const albumWrapEl = el.querySelector(".img");

                    if (!albumWrapEl || !(albumWrapEl instanceof HTMLElement) || !albumWrapEl.onclick) {
                        return;
                    }

                    const result = /[0-9]+/.exec(albumWrapEl.onclick.toString());

                    return result  && result[0];
                })(),
            })));
        }, { proxy, abortSignal });

        await Promise.all(tracks.map(async (t: any) => {
            if ((!t.artists || !t.artists.length) && t.id) {
                t.artists = [];

                try {
                    t.artists = (await this.getTrack(t.id, { proxy, abortSignal })).artists;
                } catch (e) {
                    // console.log(e);
                }
            }
        }));

        return tracks;
    }

    public getTrack(trackId: string, { proxy, abortSignal }: IOptions = {}) {
        return this.executeInBrowser(`${this.rootUrl}${NaverMusicMobile.GET_TRACK_PATH}?trackId=${trackId}`, () => ({
            title: (() => {
                const idWrapEl = document.querySelector("#titleArea span");

                return idWrapEl && idWrapEl instanceof HTMLElement && idWrapEl.innerText;
            })(),

            artists: (() => [
                ...document.querySelectorAll(".art_name a"),
            ].map((el) => el instanceof HTMLElement && el.innerText))(),
        }), { proxy, abortSignal });
    }

    private async executeInBrowser(url: string, callback: () => any, {
        proxy,
        abortSignal,
        browserPageInstance,
    }: IOptions = {}) {
        let browser: Browser|undefined;

        const browserPage = await (async (instance) => {
            if (instance) {
                return instance;
            }

            browser = await this.getBrowserInstance({ proxy, abortSignal });

            return await browser.newPage();
        })(browserPageInstance);

        if (abortSignal) {
            abortSignal.addEventListener("abort", () => {
                browserPage.close();
            });
        }

        try {
            await browserPage.setRequestInterception(true);

            browserPage.on("request", (request) => {
                if (request.resourceType() === "image") {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await browserPage.setViewport({ width: 320, height: 568 });

            if (this.userAgent) {
                await browserPage.setUserAgent(this.userAgent);
            }

            await browserPage.goto(url);

            const data = await browserPage.evaluate(callback);

            (async () => {
                await browserPage.close();

                if (browser) {
                    browser.close();
                }
            })();

            return data;
        } catch (e) {
            (async () => {
                await browserPage.close();

                if (browser) {
                    browser.close();
                }
            })();

            throw e;
        }
    }

    private async getBrowserInstance({ proxy, abortSignal }: { proxy?: string, abortSignal?: AbortSignal } = {}) {
        const browser = await (async () => {
            if (proxy) {
                const proxyUrl = parse(proxy);

                return await launch({
                    args: [`--proxy-server=${proxyUrl.host}:${proxyUrl.port}`],
                    ignoreHTTPSErrors: true,
                });
            }

            return await launch({ ignoreHTTPSErrors: true });
        })();

        if (abortSignal) {
            abortSignal.addEventListener("abort", () => {
                browser.close();
            });
        }

        return browser;
    }
}
