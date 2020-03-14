export default class {
    public readonly urls: string[];
    public readonly quality: number;
    public readonly statical: boolean;
    public readonly cached: boolean;
    public readonly live: boolean;

    constructor(urls: string[], { quality = 0, statical = false, cached = false, live = false } = {}) {
        if (Array.isArray(urls)) {
            this.urls = urls.filter((url) => url);
        } else {
            this.urls = urls && [urls];
        }

        this.quality = quality;
        this.statical = statical;
        this.cached = cached;
        this.live = live;
    }

}
