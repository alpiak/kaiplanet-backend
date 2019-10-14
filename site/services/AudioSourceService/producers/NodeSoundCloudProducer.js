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
        _playbackQuality;

        constructor(tracks, source, { playbackQuality = 0 } = {}) {
            super(tracks);

            this._source = source;
            this._playbackQuality = playbackQuality;
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

        async search(keywords, source, { limit, playbackQuality = 0 } = {}) {
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

        async getPlaybackSources(id, source, { playbackQuality = 0 } = {}) {
            try {
                const tracks = await SC.get('/tracks', { ids: String(id) });

                return tracks && tracks
                    .map((track) => track && track.stream_url && `${track.stream_url}?client_id=${SC.clientId}`)
                    .filter((url) => url)
                    .map((url) => new Track.PlaybackSource([url], 0));
            } catch (e) {
                return [];
            }
        }

        async getRecommend({ name, artists }, source, { playbackQuality = 0 }) {
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

            const trackList = new NodeSoundCloudTrackList(tracks, source, { playbackQuality });

            return trackList.get(Math.floor(trackList.length * Math.random())) || null;
        }

        async getAlternativeTracks(track, source, { playbackQuality = 0, limit } = {}) {
            return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { playbackQuality, limit })).values();
        }

        async getTrack(id, source, { playbackQuality = 0 } = {}) {
            const track = await (async () => {
                try {
                    return (await SC.get('/tracks', { ids: String(id) }))[0];
                } catch (e) {
                    console.log(e);

                    throw e;
                }
            })();

            if (track) {
                return new Track(String(track.id), track.title, track.duration, [new Artist(track.user.username)], track.artwork_url || undefined, source, track.stream_url ? [new Track.PlaybackSource([`${track.stream_url}?client_id=${SC.clientId}`], 0)] : undefined);
            }

            return null;
        }
    }
};
