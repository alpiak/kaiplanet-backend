// @ts-ignore
import { simplify, traditionalize } from "hanzi-tools";

import IOptions from "../IMethodOptions";
import IProducer from "../IProducer";

import Artist from "../Artist";
import Instance from "../Instance";
import List from "../List";
import PlaybackSource from "../PlaybackSource";
import Producer from "../Producer";
import Source from "../Source";
import Track from "../Track";
import TrackList from "../TrackList";

import { getConfig } from "../utils";

const config = getConfig();

class UFONetworkTrackList extends TrackList<any> {
    public async get(index: number) {
        const track = this.tracks[index];

        if (!track) {
            return null;
        }

        return track;
    }
}

export default class UFONetworkProducer extends Producer implements IProducer { // tslint:disable-line
    public static readonly sources = [Source.ufo];
    public static readonly instances = config.producers.ufoNetwork.instances
        .map((instance: any) => new Instance(instance.host, instance.port, instance.protocol));

    private static channels = [{
        id: "ufo",
        name: "飛碟電台",
        path: "/ufo",
        picture: "https://farm8.staticflickr.com/7836/33544385918_eb1605f2ff_o.jpg",
    }];

    private readonly host: string;
    private readonly port: number;
    private readonly protocol: string;

    constructor(host?: string, port?: number, protocol = "http") {
        if (!host || !port) {
            throw Producer.noHostOrNoPortSpecifiedError;
        }

        super();

        this.host = host;

        if (typeof port === "undefined") {
            this.port = protocol === "https" ? 443 : 80;
        } else {
            this.port = port;
        }

        this.protocol = protocol;
    }

    public async search(keywords: string, source: Source, { playbackQuality = 0, limit, abortSignal }: IOptions = {}) {
        return new UFONetworkTrackList(UFONetworkProducer.channels
            .filter((c) => keywords
                .split(/(?:\s|,|，)+/)
                .reduce((keywordMatched: boolean, keyword) => keywordMatched || [c.id, c.name, c.path]
                    .flatMap((field) => [field, simplify(field), traditionalize(field)])
                    .reduce((matched: boolean, field) => matched || field.search(keyword) !== -1, false), false))
            .map((c) => this.getTrack(c.id, source)));
    }

    public async getPlaybackSources(id: string, source: Source, { playbackQuality = 0 } = {}) {
        const channel = UFONetworkProducer.channels.filter((c) => c.id === id)[0];

        if (!channel) {
            return [];
        }

        return [new PlaybackSource([`${this.protocol}://${this.host}:${this.port}${channel.path}`], {
            live: true,
            quality: playbackQuality,
            statical: true,
        })];
    }

    public async getLists(source: Source, { abortSignal }: IOptions = {}) {
        return UFONetworkProducer.channels.map((c) => new List(c.id, c.name, source));
    }

    public async getList(id: string, source: Source, { playbackQuality, limit, offset, abortSignal }: IOptions = {}) {
        const channel = UFONetworkProducer.channels.filter((c) => c.id === id)[0];

        if (!channel) {
            return null;
        }

        return [new Track(channel.id, channel.name, [new Artist(channel.name)], source, {
            duration: Infinity,
            picture: channel.picture,

            playbackSources: [new PlaybackSource([`${this.protocol}://${this.host}:${this.port}${channel.path}`], {
                live: true,
                quality: playbackQuality,
                statical: true,
            })],
        })];
    }

    public async getTrack(id: string, source: Source, { playbackQuality = 0 } = {}) {
        const channel = UFONetworkProducer.channels.filter((c) => c.id === id)[0];

        if (!channel) {
            return null;
        }

        return new Track(channel.id, channel.name, [new Artist(channel.name)], source, {
            duration: Infinity,
            picture: channel.picture,

            playbackSources: [new PlaybackSource([`${this.protocol}://${this.host}:${this.port}${channel.path}`], {
                live: true,
                quality: playbackQuality,
                statical: true,
            })],
        });
    }
}
