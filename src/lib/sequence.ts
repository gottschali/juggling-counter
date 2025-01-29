export interface Event {
    length: number
    end: number
}

export class Sequence {
    public events: Event[]
    public time: Date
    constructor() {
        this.events = []
        this.time = new Date()
    }

    add(e: Event) {
        this.events.push(e)
    }

}