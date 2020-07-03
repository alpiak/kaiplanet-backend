import IProducerMethodOptions from "./IProducerMethodOptions";

import Area from "./Area";
import Proxy from "./Proxy";

export default interface IProducer {
    fetchProxyList(length: number, area: Area, options?: IProducerMethodOptions): Promise<Proxy[]|null>|null;
}
