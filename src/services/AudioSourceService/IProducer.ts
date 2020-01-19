import IMethodOptions from "./IMethodOptions";

import List from "./List";
import PlaybackSource from "./PlaybackSource";
import Source from "./Source";
import Track from "./Track";
import TrackList from "./TrackList";

export default interface IProducer {
    id: string;
    proxyPool: any;
    search(keywords: string, source: Source, options?: IMethodOptions): Promise<TrackList<any>>;
    getPlaybackSources(id: string, source: Source, options?: IMethodOptions): Promise<PlaybackSource[]>;
    getRecommends(source: Source, track?: Track, options?: IMethodOptions): Promise<Track[]|null>;
    getLists(source: Source, options?: IMethodOptions): Promise<List[]|null>;
    getList(id: string, source: Source, options?: IMethodOptions): Promise<Track[]|null>;
    getAlterTracks(track: Track, source: Source, options?: IMethodOptions): Promise<Track[]|null>;
    getTrack(id: string, source: Source, options?: IMethodOptions): Promise<Track|null>;
}
