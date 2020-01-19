import Track from "./Track";

export default class <T> {
    protected readonly tracks: any[];

    get length() {
        return this.tracks.length;
    }

    constructor(tracks: T[] = []) {
        this.tracks = tracks;
    }

    public async get(index: number): Promise<Track|null> {
        return this.tracks[index] || null;
    }

    public async values(): Promise<Track[]> {
        return ((await Promise
            .all(this.tracks.map(async (t: T, i: number) => await this.get(i)))).filter((t) => t) as Track[]);
    }
}
