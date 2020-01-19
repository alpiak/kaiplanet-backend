export default class {
    public readonly urls: string[];
    public readonly quality: number;
    public readonly statical: boolean;
    public readonly cached: boolean;

    constructor(urls: string[], { quality = 0, statical = false, cached = false } = {}) {
        if (Array.isArray(urls)) {
            this.urls = urls.filter((url) => url);
        } else {
            this.urls = urls && [urls];
        }

        this.quality = quality;
        this.statical = statical;
        this.cached = cached;
    }

}
