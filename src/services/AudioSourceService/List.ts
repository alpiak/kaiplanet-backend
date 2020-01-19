import Source from "./Source";
import Track from "./Track";

export default class {
    public readonly id: string;
    public readonly name: string;
    public readonly source: Source;

    constructor(id: string, name: string, source: Source) {
        this.id = id;
        this.name = name;
        this.source = source;
    }

    public async getList(): Promise<Track[]> {
        return [new Track("", "", [], this.source)];
    }
}
