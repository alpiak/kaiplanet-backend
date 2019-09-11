module.exports = ({ Artist, Track, TrackList, List, Source, Producer }) => class KaiPlanetProducer extends Producer {
    static get sources() {
        return KaiPlanetProducer._sources;
    }

    static _sources = [Source.kaiPlanet];

    async getStreamUrls(id, source) {
        try {
            return ["http://kaiplanet.net/demo.mp3"];
        } catch (e) {
            return [];
        }
    }

    async getLists(source) {
        return [new List("demo", "Demo", source)];
    }

    async getList(id, source) {
        return [new Track(0, "Demo", undefined, [new Artist("Unknown")], "http://kaiplanet.net/lighthouse.jpg", source)];
    }
};
