import Status from "./Status";

export default class {
    public readonly status: Status;
    public readonly responseTime?: number;
    public readonly speed?: number;

    constructor(status: Status, responseTime?: number|null, speed?: number|null) {
        this.status = status;
        this.responseTime = responseTime || undefined;
        this.speed = speed || undefined;
    }
}
