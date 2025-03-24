import { average, stdv } from "./mathUtils";
import type { PeakDetector } from "./PeakDetector";

// For 3 ball cascase with beanbags i get
// µ=29.3  std=24.05
// Threshold shoud be at least the average
// For loud juggling, the peaks are pronounced are at least a standard deviation away.

// Unfortunately, silent catches in between stop the sequence.
export class SimpleOnlinePeakDetector implements PeakDetector {
    private previousPeakIndex: number;
    // A peak must exceed the value theshold
    private threshold: number;
    private counter: number;
    // Minimum time between throws, in seconds
    private distanceSec;
    private distance // in segments
    // Processing
    private window: number[];
    private signal: number[];
    dynamicThreshold: boolean;

    constructor(batchDuration: number, {
        threshold = 40,
        distanceSec = 0.15,
        dynamicThreshold = false
    }) {
        this.threshold = threshold
        this.dynamicThreshold = dynamicThreshold
        this.distanceSec = distanceSec
        this.previousPeakIndex = 0;
        this.counter = 0;
        this.distance = Math.round(this.distanceSec / batchDuration)
        this.window = new Array(Math.max(3, Math.ceil(this.distance / 2)))
        this.signal = []
    }

    update(value: number): number {
        // Average over all freqs to smooth the signal
        // Could select a frequency band. Using everything is quite robust.
        this.signal.push(value)
        this.window.shift();
        this.window.push(value);
        this.counter += 1;
        // distance in number of segments to the previous peak
        const dist = this.counter - this.previousPeakIndex;

        if (value < this.threshold) {
            // the value is to low to be considered a peak
            return 0
        }

        if (dist < this.distance) {
            // there has been a peak recently
            return 0
        }

        const prevVal = this.window[this.window.length - 2]
        // Check that the previous value is a local maximum
        // Also check that the previous value is the maximum for the window
        //  .^.
        // .
        //.     
        const maxInWindow = prevVal >= Math.max(...this.window) - 1e-5;
        const localMax = (
            this.window[this.window.length - 3] <= prevVal &&
            prevVal >= this.window[this.window.length - 1]
        )

        if (localMax && maxInWindow) {
            const avg = average(this.signal)
            const std = stdv(this.signal, avg)
            if (this.dynamicThreshold) {
                this.threshold = avg + std / 2
            }
            console.debug("PEAK", this.counter, "val", value, "avg", avg, "std", std, "tau", this.threshold)
            this.previousPeakIndex = this.counter

            return 1
        }

        return 0
    }
}