module.exports = ({ Artist, Track, TrackList, List, Source, Producer, config }) => {
    const SC = require("node-soundcloud");

    SC.get = (() => {
        const _SCGet = SC.get;

        return (path, params) => new Promise((resolve, reject) => {
            try {
                _SCGet.call(SC, path, params, (err, data) => {
                    if (err) {
                        return reject(err);
                    }

                    resolve(data);
                });
            } catch (e) {
                reject(e);
            }
        })
    })();

    SC.init({ id: config.producers.nodeSoundCloud.clientId });

    class NodeSoundCloudTrackList extends TrackList {
        _source;

        constructor(tracks, source) {
            super(tracks);
            this._source = source;
        }

        async get(index) {
            const track = this._tracks[index];

            if (!track) {
                return null;
            }

            return new Track(String(track.id), track.title, +track.duration, [new Artist(track.user.username)], track.artwork_url, this._source);
        }
    }

    return class NodeSoundCloudProducer extends Producer {
        static get sources() {
            return NodeSoundCloudProducer._sources;
        }

        static _sources = [Source.soundCloud];

        async search(keywords, source, { limit } = {}) {
            const tracks = (await (async () => {
                try {
                    return await SC.get('/tracks', {
                        q: keywords,
                        limit
                    });
                } catch (e) {
                    throw e;
                }
            })()) || [];

            return new NodeSoundCloudTrackList(tracks, source);
        }

        async getStreamUrls(id, source) {
            try {
                const tracks = (await SC.get('/tracks', { ids: String(id) }));

                return tracks && tracks.map((track) => track && track.stream_url && `${track.stream_url}?client_id=${SC.clientId}`).filter((url) => url);
            } catch (e) {
                return [];
            }
        }

        async getRecommend({ name, artists }, source) {
            const tracks = await (async () => {
                if (name) {
                    const matchedTrack = (await SC.get('/tracks', {
                        q: [name, ...artists.map((artist) => artist.name)].join(","),
                        limit: 1
                    }))[0];

                    if (matchedTrack) {
                        const tracks = await SC.get('/tracks', { tags: matchedTrack.tag_list.replace(/\s*"(?:.|\n)*"/g, '').replace(/^\s*/g, '').split(/\s+/).join(',') });

                        if (tracks && tracks.length > 1) {
                            return tracks.slice(1);
                        }
                    }
                }

                return null;
            })();

            if (!tracks || !tracks.length) {
                return null;
            }

            const trackList = new NodeSoundCloudTrackList(tracks, source);

            return trackList.get(Math.floor(trackList.length * Math.random())) || null;
        }

        async getAlternativeTracks(track, source, { limit } = {}) {
            return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { limit })).values();
        }
    }
};
