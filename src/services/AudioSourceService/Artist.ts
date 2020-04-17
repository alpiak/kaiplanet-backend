export default class {
    public readonly name: string;
    public readonly aliases?: string[];

    constructor(name: string, { aliases }: { aliases?: string[] } = {}) {
        this.name = name;
        this.aliases = aliases;
    }
}
