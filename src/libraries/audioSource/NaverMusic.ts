import { parse } from "url";

import { Browser, launch, Page } from "puppeteer";

interface IOptions {
    page?: number;
    proxy?: string;
    abortSignal?: AbortSignal;
    enableJavaScript?: boolean;
    browserPageInstance?: Page;
}

export default class NaverMusic {
    public static TOP_ONE_HUNDERD_DOMAINS = ["TOTAL_V2", "DOMESTIC_V2", "OVERSEA_V2"];

    private static SEARCH_PATH = "/search/search.nhn";
    private static GET_ALBUM_PATH = "/album/index.nhn";
    private static GET_TOP_ONE_HUNDRED_PATH = "/listen/top100.nhn";

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

    public search(query: string|string[], { page, proxy, abortSignal, browserPageInstance }: IOptions = {}) {
        return this.executeInBrowser(`${this.rootUrl}${NaverMusic.SEARCH_PATH}?query=${([] as string[]).concat(query).join("+")}&target=track&page=${page}`, async () => {
            const tracks = [];

            for (const el of [...document.querySelectorAll("._tracklist_move")].slice(1)) {
                tracks.push({
                    id: (() => {
                        const idWrapEl = el.querySelector(".name>._title");

                        return idWrapEl && idWrapEl instanceof HTMLAnchorElement && idWrapEl.hash.slice(1);
                    })(),

                    name: (() => {
                        const titleWrapEl = el.querySelector(".name>._title>.ellipsis");

                        return titleWrapEl && titleWrapEl instanceof HTMLElement && titleWrapEl.innerText;
                    })(),

                    artists: await (async () => {
                        const singleWrapEl = el.querySelector(".artist>._artist>.ellipsis");

                        if (singleWrapEl && singleWrapEl instanceof HTMLElement) {
                            return [singleWrapEl.innerText];
                        }

                        const event = document.createEvent("MouseEvents");

                        event.initEvent("click", true, false );
                        document.body.dispatchEvent(event);

                        await new Promise((r) => setTimeout(r, 0));
                        await new Promise((r) => setTimeout(r, 0));

                        const artistTriggerEl = el.querySelector("._artist>a");

                        if (!artistTriggerEl) {
                            return;
                        }

                        artistTriggerEl.dispatchEvent(event);

                        return [
                            ...document.querySelectorAll("#scroll_tl_artist a"),
                        ].map((artistWrapEl) => artistWrapEl instanceof HTMLAnchorElement && artistWrapEl.innerText);
                    })(),

                    albumId: (() => {
                        const albumWrapEl = el.querySelector(".album>._album") as HTMLAnchorElement;

                        return albumWrapEl && albumWrapEl.href.split("?")[1]
                            .split("&")
                            .reduce((albumId: string|null, queryField: string) => {
                                if (albumId) {
                                    return albumId;
                                }

                                const [key, value] = queryField.split("=");

                                if (key === "albumId") {
                                    return value;
                                }

                                return albumId;
                            }, null);
                    })(),
                });
            }

            return tracks;
        }, { proxy, abortSignal, browserPageInstance });
    }

    public async getAlbum(albumId: string, { proxy, abortSignal, browserPageInstance }: IOptions = {}) {
        return this.executeInBrowser(`${this.rootUrl}${NaverMusic.GET_ALBUM_PATH}?albumId=${albumId}`, async () => {
            return {
                name: (() => {
                    const titleWrapEl = document.querySelector("#content .info_txt h2");

                    return titleWrapEl && titleWrapEl instanceof HTMLElement && titleWrapEl.innerText;
                })(),

                image: (() => {
                    const imageWrapEl = document.querySelector("meta[property='og:image']");

                    return imageWrapEl && imageWrapEl instanceof HTMLMetaElement && imageWrapEl.content;
                })(),
            };
        }, { proxy, abortSignal, browserPageInstance });
    }

    public async getTop100(domain: string, { proxy, abortSignal, browserPageInstance }: IOptions = {}) {
        const url = `${this.rootUrl}${NaverMusic.GET_TOP_ONE_HUNDRED_PATH }?domain=${domain}`;

        return await this.executeInBrowser(url, async () => {
            const tracks = [];

            for (const el of [...document.querySelectorAll("._tracklist_move")].slice(1)) {
                tracks.push({
                    id: (() => {
                        const idWrapEl = el.querySelector(".name>._title");

                        return idWrapEl && idWrapEl instanceof HTMLAnchorElement && idWrapEl.hash.slice(1);
                    })(),

                    name: (() => {
                        const titleWrapEl = el.querySelector(".name>._title>.ellipsis");

                        return titleWrapEl && titleWrapEl instanceof HTMLElement && titleWrapEl.innerText;
                    })(),

                    artists: await (async () => {
                        const singleWrapEl = el.querySelector(".artist>._artist>.ellipsis");

                        if (singleWrapEl && singleWrapEl instanceof HTMLElement) {
                            return [singleWrapEl.innerText];
                        }

                        const event = document.createEvent("MouseEvents");

                        event.initEvent("click", true, false );
                        document.body.dispatchEvent(event);

                        await new Promise((r) => setTimeout(r, 0));
                        await new Promise((r) => setTimeout(r, 0));

                        const artistTriggerEl = el.querySelector("._artist>a");

                        if (!artistTriggerEl) {
                            return;
                        }

                        artistTriggerEl.dispatchEvent(event);

                        return [
                            ...document
                                .querySelectorAll("#scroll_tl_artist a"),
                        ].map((artistWrapEl) => artistWrapEl instanceof HTMLAnchorElement &&  artistWrapEl.innerText);
                    })(),
                });
            }

            return {
                title: (() => {
                   const titleWrapEl = document.querySelector("#content .tit span");

                   return titleWrapEl && titleWrapEl instanceof HTMLElement && titleWrapEl.innerText;
                })(),

                tracks,
            };
        }, { proxy, abortSignal, browserPageInstance });
    }

    public async getTop100Thumbs(domain: string, { proxy, abortSignal, browserPageInstance }: IOptions = {}) {
        const url = `${this.rootUrl}${NaverMusic.GET_TOP_ONE_HUNDRED_PATH }?domain=${domain}`;

        return await this.executeInBrowser(url, async () => {
            const map: any = {};

            for (const el of [...document.querySelectorAll("._tracklist_move")].slice(1)) {
                const idWrapEl = el.querySelector(".name>._title");

                if (idWrapEl && idWrapEl instanceof HTMLAnchorElement) {
                    map[idWrapEl.hash.slice(1)] = (() => {
                        const thumbWrapEl = el.querySelector(".thumb>img") as HTMLImageElement;

                        return thumbWrapEl && thumbWrapEl.src;
                    })();
                }
            }

            return map;
        }, { proxy, abortSignal, enableJavaScript: false, browserPageInstance });
    }

    private async executeInBrowser(url: string, callback: () => any, {
        proxy,
        abortSignal,
        enableJavaScript = true,
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
            if (!enableJavaScript) {
                await browserPage.setJavaScriptEnabled(false);
            }

            await browserPage.setRequestInterception(true);

            browserPage.on("request", (request) => {
                if (request.resourceType() === "image") {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            if (this.userAgent) {
                await browserPage.setUserAgent(this.userAgent);
            }

            await browserPage.goto(url);

            if (!enableJavaScript) {
                await browserPage.setJavaScriptEnabled(true);
            }

            const tracks = await browserPage.evaluate(callback);

            (async () => {
                await browserPage.close();

                if (browser) {
                    browser.close();
                }
            })();

            return tracks;
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
