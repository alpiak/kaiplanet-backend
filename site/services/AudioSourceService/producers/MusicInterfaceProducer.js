const MusicInterface = require("../../../libraries/audioSource/MusicInterface")();

module.exports = ({ Artist, Track, TrackList, List, Source, Producer, config }) => class MusicInterfaceProducer extends Producer {
    static _sources = [Source.qq];
    static _instances = config.producers.musicInterface.instances.map((instance) => new Producer.Instance(instance.host, instance.port, instance.protocol));

    static get sources() {
        return MusicInterfaceProducer._sources;
    }

    static get instances() {
        return MusicInterfaceProducer._instances;
    }

    _musicInterface;

    constructor(host, port, protocol) {
        super();
        this._musicInterface = new MusicInterface(host, port, protocol);
    }

    async search(keywords, source, { limit, playbackQuality = 0 } = {}) {
        const tracks = (await (async () => {
            try {
                return await this._musicInterface.search(keywords, 1, limit);
            } catch (e) {
                throw e;
            }
        })()).songList.filter((songData) => songData.songMid) || [];

        const getPicture = (track) => this._getPicture(track);

        return new class extends TrackList {
            async get(index) {
                const track = this._tracks[index];

                if (!track) {
                    return null;
                }

                const picture = await (async (track) => {
                    try {
                        return await getPicture(track);
                    } catch (e) {
                        return null;
                    }
                })(track);

                return new Track(track.songMid, track.songName, null, track.singer.map((singer) => new Artist(singer.singerName)), picture, source);
            }
        }(tracks);
    }

    async getPlaybackSources(id, source, { playbackQuality = 0 } = {}) {
        try {
            return (await this._musicInterface.getSongUrllist([id]))
                .filter((url) => url)
                .filter((url) => url !== "http://isure.stream.qqmusic.qq.com//")
                .map((url) => new Track.PlaybackSource([url], 0));
        } catch (e) {
            return [];
        }
    }

    async getRecommend(track, source, { playbackQuality = 0 } = {}) {
        if (!track) {
            const tracks = await (async () => {
                const lists = await (() => {
                    try {
                        return this._musicInterface.getToplists();
                    } catch (e) {
                        throw e;
                    }
                })();

                if (lists && lists.length) {
                    const randomList = lists[Math.floor(lists.length * Math.random())];

                    try {
                        return (await this._musicInterface.getSongList(randomList.id)) || null;
                    } catch (e) {
                        throw e;
                    }
                }

                return null;
            })();

            if (!tracks || !tracks.length) {
                return await super.getRecommend(track, source, { playbackQuality });
            }

            const randomTrack = tracks[Math.floor(tracks.length * Math.random())];

            const picture = await (async () => {
                try {
                    return await this._getPicture(randomTrack);
                } catch (e) {
                    return null;
                }
            })();

            return new Track(randomTrack.songMid, randomTrack.songName, null, randomTrack.singer.map((singer) => new Artist(singer.singerName)), picture, source);
        }

        return await super.getRecommend(track, source, { playbackQuality });
    }

    async getLists(source) {
        return (await this._musicInterface.getToplists()).map((list) => new List(list.id, list.title, source));
    }

    async getList(id, source, { playbackQuality, limit, offset } = {}) {
        const tracks = await (async () => {
            try {
                return (await this._musicInterface.getSongList(id)) || null;
            } catch (e) {
                throw e;
            }
        })();

        if (tracks) {
            return await Promise.all(tracks.map(async (track) => new Track(track.songMid, track.songName, null, track.singer.map((singer) => new Artist(singer.singerName)), await this._getPicture(track), source)));
        }

        return null;
    }

    async getAlternativeTracks(track, source, { playbackQuality = 0, limit } = {}) {
        return (await this.search([track.name, ...track.artists.map((artist) => artist.name)].join(","), source, { playbackQuality, limit })).values();
    }

    async _getPicture(track) {
        try {
            return (await this._musicInterface.getAlbumImg(track.albumMid, track.singer[0] && track.singer[0].singerMid)).albumImgUrl;
        } catch (e) {
            throw e;
        }
    }
};
