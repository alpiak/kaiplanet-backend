import Artist from "./Artist";
import PlaybackSource from "./PlaybackSource";
import Source from "./Source";

interface ITrackOptions {
    duration?: number;
    picture?: string;
    playbackSources?: PlaybackSource[];
}

export default class Track {
    public readonly id: string;
    public readonly name: string;
    public readonly duration?: number;
    public readonly artists: Artist[];
    public readonly picture?: string|null;
    public readonly source: Source;
    public readonly playbackSources: PlaybackSource[]|null;

    constructor(id: string, name: string, artists: Artist[], source: Source, {
        picture,
        duration,
        playbackSources,
    }: ITrackOptions = {}) {
        this.id = id;
        this.name = name;
        this.duration = duration;
        this.artists = artists;
        this.picture = picture;
        this.source = source;

        if (Array.isArray(playbackSources)) {
            this.playbackSources = playbackSources;
        } else {
            this.playbackSources = playbackSources ? [playbackSources] : null;
        }
    }
}
