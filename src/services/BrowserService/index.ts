import { parse } from "url";

import { Browser, launch, PageCloseOptions } from "puppeteer";

// @ts-ignore
import { rmdir } from "fs-utils";

export default class {
    private browser?: Browser;
    private proxy?: string;
    private locked = false;
    private browserTempDataDirectory?: string;

    public async createBrowserPage({ proxy }: { proxy?: string } = {}) {
        while (this.locked) {
            await new Promise(((resolve) => setTimeout(resolve, 0)));
        }

        this.locked = true;

        try {
            if (this.proxy !== proxy) {
                if (this.browser && (await this.browser.pages()).length <= 1) {
                    this.browser.close();

                    if (this.browserTempDataDirectory) {
                        rmdir(this.browserTempDataDirectory);

                        delete this.browserTempDataDirectory;
                    }
                }

                this.browser = await this.getBrowserInstance({ proxy });

                // @ts-ignore
                for (const arg of this.browser.process().spawnargs) {
                    if (arg.indexOf("--user-data-dir=") === 0) {
                        this.browserTempDataDirectory = arg.replace("--user-data-dir=", "");

                        break;
                    }
                }
            }

            if (!this.browser) {
                this.browser = await this.getBrowserInstance({ proxy });

                // @ts-ignore
                for (const arg of this.browser.process().spawnargs) {
                    if (arg.indexOf("--user-data-dir=") === 0) {
                        this.browserTempDataDirectory = arg.replace("--user-data-dir=", "");

                        break;
                    }
                }
            }

            const browser = this.browser;
            const that = this;
            const browserTempDataDirectory = that.browserTempDataDirectory;
            const page = await browser.newPage();
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

                        if (browserTempDataDirectory) {
                            rmdir(browserTempDataDirectory);

                            delete that.browserTempDataDirectory;
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
