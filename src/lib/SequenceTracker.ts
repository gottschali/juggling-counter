import type { PeakDetector } from "./PeakDetector";
import { Sequence } from "./sequence";

export class SequenceTracker {
    private detector: PeakDetector;
    private counter = 0;
    private previousPeakIndex = -1;
    // The time after which a sequence is stopped after no new throws are detected, in seconds
    private stopSec;
    private stop: number // in segments
    // Minimum number of events such that the sequence is logged
    private minSequenceLength;

    private sequences = new Array<Sequence>();
    private currentSequence = new Sequence();
    setCount: (count: number) => void;
    addSequence: (seq: Sequence) => void;

    private maxSequenceLength = 0;

    get maxLength(): number {
        return this.maxSequenceLength;
    }

    constructor(
        detector: PeakDetector,
        setCount: (count: number) => void,
        addSequence: (seq: Sequence) => void,
        batchDuration: number,
        stopSec = 0.6,
        minSequenceLength = 3
    ) {
        this.detector = detector;
        this.setCount = setCount;
        this.addSequence = addSequence;
        this.stopSec = stopSec;
        this.minSequenceLength = minSequenceLength;
        this.stop = Math.round(this.stopSec / batchDuration);
    }

    update(value: number, reset = true): number {
        this.counter += 1
        const peak = this.detector.update(value)
        console.log(value, peak)
        // distance in number of segments to the previous peak
        const dist = this.counter - this.previousPeakIndex;
        if (dist >= this.stop) {
            // no peak detected for some time, this ends the previous sequence
            if (this.currentSequence.length >= this.minSequenceLength) {
                this.sequences.push(this.currentSequence);
                this.addSequence(this.currentSequence)
                this.maxSequenceLength = Math.max(this.maxSequenceLength, this.currentSequence.length)
            }
            if (reset) {
                this.setCount(0)
            }
            this.currentSequence = new Sequence();
        }
        if (peak) {
            this.currentSequence.add({
                'index': this.counter,
            })
            if (this.currentSequence.length >= this.minSequenceLength) {
                this.setCount(this.currentSequence.length)
            }
            this.previousPeakIndex = this.counter
        }
        return value
    }
}