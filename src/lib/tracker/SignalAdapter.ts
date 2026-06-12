// Converts the existing scalar energy signal (averaged FFT byte magnitudes,
// roughly 0..255) into a pseudo-probability in [0, 1] for the JugglingTracker.
//
// This is the interim signal source: it lets the rhythm tracker improve the
// app *today*, using the same AnalyserNode pipeline. When a frame-level ML
// model lands, it replaces this class — the tracker itself is unchanged.
//
// Method: track the noise floor and its spread with asymmetric EMAs (fast to
// follow the floor down, slow to follow it up, so catch transients don't drag
// the floor along). Standardize the value against the floor and squash through
// a logistic. This replaces SimpleOnlinePeakDetector's dynamicThreshold hack
// with something stateless from the consumer's point of view.

export interface SignalAdapterConfig {
    /** EMA rate when the value is above the floor estimate (slow). */
    alphaUp: number;
    /** EMA rate when the value is below the floor estimate (fast). */
    alphaDown: number;
    /** Lower bound on the spread estimate, in signal units. */
    devMin: number;
    /** z-score mapped to p = 0.5. */
    zMid: number;
    /** Logistic steepness: z-range over which p goes ~0.27 → ~0.73. */
    zScale: number;
    /** Frames to adapt before emitting non-zero probabilities. */
    warmupFrames: number;
}

export const DEFAULT_SIGNAL_ADAPTER_CONFIG: SignalAdapterConfig = {
    alphaUp: 0.002,
    alphaDown: 0.05,
    devMin: 1.0,
    zMid: 3.0,
    zScale: 1.5,
    warmupFrames: 50,
};

export class SignalAdapter {
    private cfg: SignalAdapterConfig;
    private mu: number | null = null;
    private dev = 0;
    private frames = 0;

    constructor(cfg: Partial<SignalAdapterConfig> = {}) {
        this.cfg = { ...DEFAULT_SIGNAL_ADAPTER_CONFIG, ...cfg };
    }

    /** Current noise floor estimate (useful for "environment too noisy" UI). */
    get noiseFloor(): number {
        return this.mu ?? 0;
    }

    update(value: number): number {
        const c = this.cfg;
        if (this.mu === null) {
            this.mu = value;
            this.dev = c.devMin;
        }
        const alpha = value > this.mu ? c.alphaUp : c.alphaDown;
        this.mu += alpha * (value - this.mu);
        const absDev = Math.abs(value - this.mu);
        this.dev += (absDev > this.dev ? c.alphaUp : c.alphaDown) * (absDev - this.dev);
        this.dev = Math.max(this.dev, c.devMin);

        this.frames += 1;
        if (this.frames < c.warmupFrames) return 0;

        const z = (value - this.mu) / this.dev;
        const p = 1 / (1 + Math.exp(-(z - c.zMid) / c.zScale));
        return Math.min(Math.max(p, 0), 1);
    }
}
