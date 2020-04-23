import { parse } from "url";

import { Browser, launch, PageCloseOptions } from "puppeteer";

export default class {
    private browser?: Browser;
    private proxy?: string;

    public async createBrowserPage({ proxy }: { proxy?: string } = {}) {
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
                await close.apply(this, [options]);

                if (browser && (await browser.pages()).length <= 1) {
                    browser.close();

                    if (that.browser === browser) {
                        delete that.browser;
                    }
                }
            };

            return page;
        }

        this.browser = await this.getBrowserInstance({ proxy });

        return this.browser.newPage();
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
