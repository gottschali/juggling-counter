import {
  DEFAULT_CONFIG,
  type DebugInfo,
  type Frame,
  type RunEndReason,
  type TrackerConfig,
  type TrackerEvent,
} from "./types";

interface PendingBackfill {
  /** Interpolated times of the missed catches. */
  times: number[];
  /** Real catches still required before the fill commits. */
  confirmRemaining: number;
}

/**
 * Pure state machine: feed frames in order via update(), receive semantic
 * events back. Memory use is O(1) w.r.t. run length (2-hour runs are fine).
 *
 * Modes:
 *   idle        — nothing happening; high threshold applies
 *   provisional — a few events seen; waiting for periodicity to confirm a run
 *   active      — confirmed run; period model drives windows & low threshold
 */
export class JugglingTracker {
  readonly cfg: TrackerConfig;
  onDebug?: (d: DebugInfo) => void;

  private mode: "idle" | "provisional" | "active" = "idle";

  // 3-frame buffer for local-maximum peak picking (catch channel).
  private prev1: Frame | null = null;
  private prev2: Frame | null = null;
  private lastAcceptT = -Infinity;
  private lastDropT = -Infinity;

  // Provisional state.
  private provisionalTimes: number[] = [];

  // Active-run state (O(1): no per-catch storage).
  private count = 0;
  private runStartT = 0;
  private lastCatchT = 0;
  private T = 0;
  private sigma = 0;
  private periodSum = 0; // for mean period in runEnded
  private periodN = 0;
  private pendingBackfills: PendingBackfill[] = [];

  // Evidence collection for backfill: max sub-threshold bump in the current
  // inter-catch gap. A short delay line keeps the rising edge of the *current*
  // candidate from polluting the evidence of the gap before it.
  private gapMaxP = 0;
  private delayLine: { t: number; p: number }[] = [];

  // Warm prior from the previous run in this session.
  private prior: { T: number; t: number } | null = null;

  constructor(cfg: Partial<TrackerConfig> = {}, onDebug?: (d: DebugInfo) => void) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.onDebug = onDebug;
  }

  /** Feed one frame; returns the events it triggered (often empty). */
  update(frame: Frame): TrackerEvent[] {
    const events: TrackerEvent[] = [];
    const c = this.cfg;
    const t = frame.t;

    // ---- timeouts ----------------------------------------------------------
    if (this.mode === "active") {
      const stopSec = Math.min(c.stopAfterPeriods * this.T, c.stopAfterMaxSec);
      if (t - this.lastCatchT > stopSec) this.endRun(this.lastCatchT, "timeout", events);
    } else if (this.mode === "provisional") {
      const lastT = this.provisionalTimes[this.provisionalTimes.length - 1];
      if (t - lastT > c.provisionalTimeoutSec) {
        events.push({
          type: "runDiscarded",
          t,
          count: this.provisionalTimes.length,
          reason: "provisional timeout (no periodic confirmation)",
        });
        this.resetToIdle();
      }
    }

    // ---- backfill evidence: fold frames leaving the delay line -------------
    this.delayLine.push({ t, p: frame.pCatch });
    while (this.delayLine.length && this.delayLine[0].t <= t - c.refractorySec) {
      const old = this.delayLine.shift()!;
      if (
        this.mode === "active" &&
        old.t > this.lastCatchT + c.backfillEvidenceGuardSec
      ) {
        this.gapMaxP = Math.max(this.gapMaxP, old.p);
      }
    }

    // ---- drop channel -------------------------------------------------------
    const pDrop = frame.pDrop ?? 0;
    if (
      pDrop >= c.pDropThreshold &&
      t - this.lastDropT >= c.dropRefractorySec
    ) {
      this.lastDropT = t;
      events.push({ type: "drop", t });
      if (c.stopOnDrop && this.mode === "active") this.endRun(t, "drop", events);
    }

    // ---- catch channel: local-max peak picking on prev1 ---------------------
    if (this.prev1 && this.prev2) {
      const cand = this.prev1;
      const isLocalMax = cand.pCatch >= this.prev2.pCatch && cand.pCatch > frame.pCatch;
      if (isLocalMax && cand.t - this.lastAcceptT >= c.refractorySec) {
        const { threshold } = this.effectiveThreshold(cand.t);
        if (cand.pCatch >= threshold) this.acceptCatch(cand.t, events);
      }
    }

    if (this.onDebug) {
      const { threshold, inWindow } = this.effectiveThreshold(t);
      this.onDebug({
        t,
        pCatch: frame.pCatch,
        mode: this.mode,
        effectiveThreshold: threshold,
        inWindow,
        T: this.mode === "active" ? this.T : null,
        sigma: this.mode === "active" ? this.sigma : null,
        count: this.count,
      });
    }

    this.prev2 = this.prev1;
    this.prev1 = frame;
    return events;
  }

  /** Call at end of stream: closes any active run. */
  flush(t: number): TrackerEvent[] {
    const events: TrackerEvent[] = [];
    if (this.mode === "active") this.endRun(this.lastCatchT, "flush", events);
    else if (this.mode === "provisional") {
      events.push({
        type: "runDiscarded",
        t,
        count: this.provisionalTimes.length,
        reason: "stream ended before confirmation",
      });
      this.resetToIdle();
    }
    return events;
  }

  // ---------------------------------------------------------------------------

  /** Threshold applicable at time t, plus whether t lies in a predicted window. */
  private effectiveThreshold(t: number): { threshold: number; inWindow: boolean } {
    const c = this.cfg;
    if (this.mode !== "active") return { threshold: c.pHigh, inWindow: false };

    const halfWidth = Math.min(
      Math.max(c.windowSigmas * this.sigma, c.windowMinFrac * this.T),
      c.windowMaxFrac * this.T,
    );
    const phase = (t - this.lastCatchT) / this.T;
    const k = Math.round(phase);
    const offset = Math.abs(phase - k) * this.T;
    // Windows exist around the next few expected beats (next catch plus the
    // beats reachable by backfill); beyond that, demand high confidence.
    const inWindow = k >= 1 && k <= c.backfillMaxGap + 1 && offset <= halfWidth;
    return { threshold: inWindow ? c.pLow : c.pHigh, inWindow };
  }

  private acceptCatch(t: number, events: TrackerEvent[]): void {
    this.lastAcceptT = t;
    switch (this.mode) {
      case "idle":
        this.mode = "provisional";
        this.provisionalTimes = [t];
        return;
      case "provisional":
        this.provisionalTimes.push(t);
        this.tryConfirm(events);
        return;
      case "active":
        this.activeCatch(t, events);
        return;
    }
  }

  private tryConfirm(events: TrackerEvent[]): void {
    const c = this.cfg;
    const ts = this.provisionalTimes;
    const intervals = ts.slice(1).map((x, i) => x - ts[i]);
    if (intervals.length === 0) return;

    // Warm path: previous run's period is a strong prior shortly afterwards.
    if (this.prior && ts[ts.length - 1] - this.prior.t <= c.warmPriorValiditySec) {
      const recent = intervals.slice(-c.kConfirmIntervalsWarm);
      if (
        recent.length >= c.kConfirmIntervalsWarm &&
        recent.every((d) => Math.abs(d - this.prior!.T) <= c.confirmTolerance * this.prior!.T)
      ) {
        this.confirmRun(median(recent), events);
        return;
      }
    }

    // Cold path: need kConfirmIntervals mutually consistent intervals.
    if (intervals.length < c.kConfirmIntervals) return;
    const recent = intervals.slice(-c.kConfirmIntervals);
    const med = median(recent);
    const consistent = recent.every((d) => Math.abs(d - med) <= c.confirmTolerance * med);
    if (consistent && med >= c.TMin && med <= c.TMax) {
      this.confirmRun(med, events);
    } else if (ts.length > c.kConfirmIntervals + 2) {
      // Slide: forget the oldest event so a noisy prefix can't block forever.
      this.provisionalTimes = ts.slice(1);
    }
  }

  private confirmRun(T: number, events: TrackerEvent[]): void {
    const c = this.cfg;
    const ts = this.provisionalTimes;
    const counted = c.firstThrowPolicy === "ignoreFirst" ? ts.slice(1) : ts;

    this.mode = "active";
    this.T = T;
    this.sigma = c.sigmaInitFrac * T;
    this.count = 0;
    this.runStartT = ts[0];
    this.lastCatchT = ts[ts.length - 1];
    this.periodSum = 0;
    this.periodN = 0;
    this.pendingBackfills = [];
    this.gapMaxP = 0;

    events.push({ type: "runStarted", t: ts[0], count: 0 });
    for (const ct of counted) {
      this.count += 1;
      events.push({ type: "catch", t: ct, count: this.count });
    }
    this.provisionalTimes = [];
  }

  private activeCatch(t: number, events: TrackerEvent[]): void {
    const c = this.cfg;
    const gap = t - this.lastCatchT;
    const k = Math.max(1, Math.round(gap / this.T));

    // Backfill: gap spans k beats; k-1 catches were missed.
    if (
      c.backfillEnabled &&
      k >= 2 &&
      k - 1 <= c.backfillMaxGap &&
      (!c.backfillRequiresEvidence || this.gapMaxP >= c.backfillEvidenceMinP)
    ) {
      const times: number[] = [];
      for (let i = 1; i < k; i++) times.push(this.lastCatchT + (gap * i) / k);
      this.pendingBackfills.push({ times, confirmRemaining: c.backfillConfirmAfter });
    }

    // Period & jitter update (per-beat residual, robust to spanned gaps).
    const perBeat = gap / k;
    this.T += c.alphaT * (perBeat - this.T);
    this.T = Math.min(Math.max(this.T, c.TMin), c.TMax);
    this.sigma += c.alphaSigma * (Math.abs(perBeat - this.T) - this.sigma);
    this.sigma = Math.min(
      Math.max(this.sigma, c.sigmaMinFrac * this.T),
      c.sigmaMaxFrac * this.T,
    );
    this.periodSum += perBeat;
    this.periodN += 1;

    this.count += 1;
    events.push({ type: "catch", t, count: this.count });

    // Commit pending backfills that have earned enough confirmation.
    const still: PendingBackfill[] = [];
    for (const pb of this.pendingBackfills) {
      pb.confirmRemaining -= 1;
      if (pb.confirmRemaining <= 0) {
        for (const bt of pb.times) {
          this.count += 1;
          events.push({ type: "catchBackfilled", t: bt, count: this.count });
        }
      } else {
        still.push(pb);
      }
    }
    this.pendingBackfills = still;

    this.lastCatchT = t;
    this.gapMaxP = 0;
  }

  private endRun(t: number, reason: RunEndReason, events: TrackerEvent[]): void {
    const c = this.cfg;
    // Uncommitted backfills die with the run: if the run didn't continue,
    // the "missed catches" were probably the run ending.
    if (this.count >= c.minRunCatches) {
      this.prior = { T: this.T, t };
      events.push({
        type: "runEnded",
        t,
        count: this.count,
        durationSec: t - this.runStartT,
        meanPeriodSec: this.periodN > 0 ? this.periodSum / this.periodN : this.T,
        reason,
      });
    } else {
      events.push({
        type: "runDiscarded",
        t,
        count: this.count,
        reason: `run shorter than minRunCatches (${reason})`,
      });
    }
    this.resetToIdle();
  }

  private resetToIdle(): void {
    this.mode = "idle";
    this.provisionalTimes = [];
    this.pendingBackfills = [];
    this.count = 0;
    this.gapMaxP = 0;
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
