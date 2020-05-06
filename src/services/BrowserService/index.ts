import { parse } from "url";

import { Browser, launch, PageCloseOptions } from "puppeteer";

export default class {
    private browser?: Browser;
    private proxy?: string;
    private locked = false;

    public async createBrowserPage({ proxy }: { proxy?: string } = {}) {
        while (this.locked) {
            await new Promise(((resolve) => setTimeout(resolve, 0)));
        }

        this.locked = true;

        try {
            if (this.browser) {
                if (this.proxy !== proxy) {
                    if (this.browser && (await this.browser.pages()).length <= 1) {
                        this.browser.close();
                    }

                    this.browser = await this.getBrowserInstance({ proxy });
                }

                const page = await this.browser.newPage();
                const that = this;
                const browser = that.browser;
                const close = page.close;

                page.close = async function(options?: PageCloseOptions) {
                    while (that.locked) {
                        await new Promise(((resolve) => setTimeout(resolve, 0)));
                    }

                    that.locked = true;

                    try {
                        await close.apply(this, [options]);

                        if (browser && (await browser.pages()).length <= 1) {
                            browser.close();

                            if (that.browser === browser) {
                                delete that.browser;
                            }
                        }

                        that.locked = false;
                    } catch (e) {
                        that.locked = false;

                        throw e;
                    }
                };

                this.locked = false;

                return page;
            }

            this.browser = await this.getBrowserInstance({ proxy });

            const newPage = await this.browser.newPage();

            this.locked = false;

            return newPage;
        } catch (e) {
            this.locked = false;

            throw e;
        }
    }

    private async getBrowserInstance({ proxy }: { proxy?: string } = {}) {
        return await (async () => {
            if (proxy) {
                const proxyUrl = parse(proxy);

                return await launch({
                    args: [`--proxy-server=${proxyUrl.host}:${proxyUrl.port}`],
                    ignoreHTTPSErrors: true,
                });
            }

            return await launch({ ignoreHTTPSErrors: true });
        })();
    }
}
