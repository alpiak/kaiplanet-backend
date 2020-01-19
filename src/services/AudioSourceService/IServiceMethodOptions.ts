import IMethodOptions from "./IMethodOptions";

export default interface IServiceMethodOptions extends IMethodOptions {
    sourceIds?: string[];
    sourceRating?: any;
    noCache?: boolean;
    retrievePlaybackSource?: boolean;
    withPlaybackSourceOnly?: boolean;
}
