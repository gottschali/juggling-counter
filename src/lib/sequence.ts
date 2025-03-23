// todo i guess remove?
// maybe we add more metadata later
export interface Event {
    index: number
}

export class Sequence {
    private events: Event[]
    public time: Date
    public endTime: Date
    public pattern: string
    public meta: {batchDuration?: number} = {}

    constructor(pattern = "") {
        this.pattern = pattern
        this.events = []
        this.time = new Date()
        this.endTime = this.time
    }

    get length(): number {
        return this.events.length
    }

    getEvents(): Event[] {
        return new Array(...this.events)
    }

    add(e: Event) {
        this.events.push(e)
        this.endTime = new Date()
    }

}