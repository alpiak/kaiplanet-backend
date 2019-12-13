module.exports = () => {
    return class {
        _tracks;

        get length() {
            return this._tracks.length;
        }

        constructor(tracks = []) {
            this._tracks = tracks;
        }

        async get(index) {
            if (typeof index === "undefined") {
                return this._tracks;
            }

            return this._tracks[index] || null;
        }

        async values() {
            return (await Promise.all(this._tracks.map(async (track, i) => await this.get(i)))).filter((track) => track);
        }
    };
};
