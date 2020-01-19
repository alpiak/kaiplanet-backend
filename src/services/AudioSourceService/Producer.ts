import IMethodOptions from "./IMethodOptions";
import IProducer from "./IProducer";

import Instance from "./Instance";
import List from "./List";
import PlaybackSource from "./PlaybackSource";
import Source from "./Source";
import Track from "./Track";
import TrackList from "./TrackList";

export default class Producer implements IProducer {
    public static readonly sources: Source[] = [];
    public static readonly instances: Instance[];
    protected static PROXY_RETRY_TIMES = 1;
    protected static noHostOrNoPortSpecifiedError = new Error("No host or no port specified.");
    public id = "";

    public proxyPool = {
        getProxyList() {
            return null;
        },

        getRandomProxy(areaCode: string): string|null {
            return null;
        },
    };

    constructor(host?: string, port?: number, protocol?: string) { /**/ }

    public async search(keywords: string, source: Source, options: IMethodOptions) {
        return new TrackList();
    }

    public async getPlaybackSources(id: string, source: Source): Promise<PlaybackSource[]> {
        return [];
    }

    public async getRecommends(source: Source, track: Track, options: IMethodOptions): Promise<Track[]|null> {
        return null;
    }

    public async getLists(source: Source): Promise<List[]|null> {
        return null;
    }

    public async getList(id: string, source: Source, options: IMethodOptions): Promise<Track[]|null> {
        return null;
    }

    public async getAlterTracks(track: Track, source: Source, options?: IMethodOptions): Promise<Track[]|null> {
        return [];
    }

    public async getTrack(id: string, source: Source): Promise<Track|null> {
        return null;
    }
}
