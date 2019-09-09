module.exports = () => class Area {
    static GLOBAL = new Area("GLOBAL");
    static CN = new Area("CN");

    _code;

    constructor(code) {
        this._code = code;
    }

    static values() {
        const values = [];

        for (const key in Area) {
            if (!Area.hasOwnProperty(key)) {
                continue;
            }

            const value = Area[key];

            if (value instanceof Area) {
                values.push(value);
            }
        }

        return values;
    }

    static fromCode(code) {
        if (!code) {
            return null;
        }

        for (const key in Area) {
            if (!Area.hasOwnProperty(key)) {
                continue;
            }

            const value = Area[key];

            if (value instanceof Area && value._code === code) {
                return value;
            }
        }
    }
};
