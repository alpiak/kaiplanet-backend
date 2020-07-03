export default class Area {
    public static GLOBAL = new Area("GLOBAL");
    public static CN = new Area("CN");

    public static values() {
        const values = [];

        for (const key in Area) {
            if (!Area.hasOwnProperty(key)) {
                continue;
            }

            // @ts-ignore
            const value = Area[key];

            if (value instanceof Area) {
                values.push(value);
            }
        }

        return values;
    }

    public static fromCode(code: string) {
        if (!code) {
            return null;
        }

        for (const key in Area) {
            if (!Area.hasOwnProperty(key)) {
                continue;
            }

            // @ts-ignore
            const value = Area[key];

            if (value instanceof Area && value.code === code) {
                return value;
            }
        }

        return null;
    }

    public readonly code: string;

    constructor(code: string) {
        this.code = code;
    }
}
