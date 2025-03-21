// todo i guess remove?
export interface Event {
    index: number
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