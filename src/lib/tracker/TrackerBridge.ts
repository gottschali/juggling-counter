// Bridges the JugglingTracker into the app's existing callback interface
// (setCount / addSequence with Sequence objects), so Controller can use it as
// a drop-in alternative to SequenceTracker.

import { Sequence } from "../sequence";
import { JugglingTracker } from "./tracker";
import { SignalAdapter } from "./SignalAdapter";
import type { DebugInfo, TrackerConfig, TrackerEvent } from "./types";

export class TrackerBridge {
    readonly tracker: JugglingTracker;
    private adapter: SignalAdapter;
    private batchDuration: number;
    private t = 0;
    private currentSequence = new Sequence();
    private setCount: (count: number) => void;
    private addSequence: (seq: Sequence) => void;

    constructor(
        setCount: (count: number) => void,
        addSequence: (seq: Sequence) => void,
        batchDuration: number,
        trackerConfig: Partial<TrackerConfig> = {},
        onDebug?: (d: DebugInfo) => void,
    ) {
        this.setCount = setCount;
        this.addSequence = addSequence;
        this.batchDuration = batchDuration;
        this.tracker = new JugglingTracker(trackerConfig, onDebug);
        this.adapter = new SignalAdapter();
    }

    /** Feed one scalar signal value (same value SequenceTracker consumes). */
    update(value: number): void {
        const pCatch = this.adapter.update(value);
        this.t += this.batchDuration;
        this.handle(this.tracker.update({ t: this.t, pCatch }));
    }

    /** Call when recording stops, to close an in-progress run. */
    stop(): void {
        this.handle(this.tracker.flush(this.t));
    }

    private handle(events: TrackerEvent[]): void {
        for (const e of events) {
            switch (e.type) {
                case "runStarted":
                    this.currentSequence = new Sequence();
                    this.currentSequence.meta.batchDuration = this.batchDuration;
                    break;
                case "catch":
                case "catchBackfilled":
                    this.currentSequence.add({
                        index: Math.round(e.t / this.batchDuration),
                    });
                    this.setCount(e.count);
                    break;
                case "runEnded":
                    this.addSequence(this.currentSequence);
                    this.setCount(0);
                    break;
                case "runDiscarded":
                    this.setCount(0);
                    break;
                case "drop":
                    // No pDrop source yet (needs the ML model); unreachable for now.
                    break;
            }
        }
    }
}
