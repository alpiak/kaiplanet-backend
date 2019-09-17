module.exports = ({ Artist, Track, TrackList, List, Source, Producer }) => class KaiPlanetProducer extends Producer {
    static get sources() {
        return KaiPlanetProducer._sources;
    }

    static _sources = [Source.kaiPlanet];

    getStreamUrls(id, source) {
        try {
            return ["http://kaiplanet.net/demo.mp3"];
        } catch (e) {
            return [];
        }
    }

    getLists(source) {
        return [new List("demo", "Demo", source)];
    }

    getList(id, source) {
        return [new Track(0, "Demo", undefined, [new Artist("Unknown")], "http://kaiplanet.net/lighthouse.jpg", source)];
    }

    getTrack(id, source) {
        return new Track(0, "Demo", undefined, [new Artist("Unknown")], "http://kaiplanet.net/lighthouse.jpg", source);
    }
};
