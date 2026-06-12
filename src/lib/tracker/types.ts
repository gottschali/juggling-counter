// ---------------------------------------------------------------------------
// Juggling run tracker — types & configuration
//
// The tracker is a pure, deterministic state machine. It consumes a stream of
// per-frame detector outputs (timestamp + catch/drop probabilities) and emits
// semantic events (run started, catch counted, run ended, ...). It knows
// nothing about audio, microphones, ML models or UI. This makes it:
//   - unit-testable against synthetic and recorded sessions
//   - replayable (tune parameters by re-running the same frames)
//   - portable (trivial to re-implement in Go for server-side re-analysis)
// ---------------------------------------------------------------------------

/** One frame of detector output. Frames must arrive in increasing t. */
export interface Frame {
  /** Timestamp in seconds (monotonic, e.g. AudioContext time). */
  t: number;
  /** Probability that a catch onset occurs at this frame, in [0, 1]. */
  pCatch: number;
  /** Probability that a drop (floor impact) occurs at this frame, in [0, 1]. */
  pDrop?: number;
}

export type FirstThrowPolicy = "count" | "ignoreFirst";

export interface TrackerConfig {
  // -- Detection thresholds -------------------------------------------------
  /** Acceptance threshold outside predicted windows (and before a run is confirmed). */
  pHigh: number;
  /** Acceptance threshold inside a predicted catch window of an active run. */
  pLow: number;
  /** Absolute minimum gap between two accepted catches, seconds (physical limit). */
  refractorySec: number;

  // -- Run lifecycle ---------------------------------------------------------
  /** Number of consistent inter-catch intervals required to confirm a run. */
  kConfirmIntervals: number;
  /** Intervals needed when a valid warm prior (previous run's period) matches. */
  kConfirmIntervalsWarm: number;
  /** Relative tolerance for interval consistency during confirmation (e.g. 0.3 = ±30%). */
  confirmTolerance: number;
  /** Run ends after this many periods without an accepted catch. */
  stopAfterPeriods: number;
  /** Absolute ceiling on the stop timeout, seconds (guards very large T). */
  stopAfterMaxSec: number;
  /** Provisional events are discarded if no confirmation within this many seconds. */
  provisionalTimeoutSec: number;
  /** Runs with fewer counted catches than this are discarded, not logged. */
  minRunCatches: number;
  /** Whether the first detected event (the launch throw) is counted. */
  firstThrowPolicy: FirstThrowPolicy;

  // -- Period model ----------------------------------------------------------
  /** Plausible period bounds, seconds. Confirmation is rejected outside these. */
  TMin: number;
  TMax: number;
  /** EMA rate for the period estimate. */
  alphaT: number;
  /** EMA rate for the jitter (sigma) estimate. */
  alphaSigma: number;
  /** Initial sigma as a fraction of T at confirmation. */
  sigmaInitFrac: number;
  /** Sigma clamp, as fractions of T (window never collapses / explodes). */
  sigmaMinFrac: number;
  sigmaMaxFrac: number;
  /** Predicted window half-width = clamp(windowSigmas * sigma, min/max fractions of T). */
  windowSigmas: number;
  windowMinFrac: number;
  windowMaxFrac: number;
  /** How long a previous run's period remains a valid warm prior, seconds. */
  warmPriorValiditySec: number;

  // -- Backfill ----------------------------------------------------------------
  backfillEnabled: boolean;
  /** Maximum number of consecutive missed catches that may be filled. */
  backfillMaxGap: number;
  /** Require a sub-threshold probability bump in the gap as evidence. */
  backfillRequiresEvidence: boolean;
  /** Minimum bump height that counts as evidence. */
  backfillEvidenceMinP: number;
  /** Ignore frames this close after a counted catch when collecting evidence
   *  (excludes the decaying tail of the previous catch's own bump). */
  backfillEvidenceGuardSec: number;
  /** Backfill commits only after this many further real catches. */
  backfillConfirmAfter: number;

  // -- Drops ---------------------------------------------------------------
  /** Threshold on pDrop for a drop event. */
  pDropThreshold: number;
  /** Minimum gap between drop events, seconds. */
  dropRefractorySec: number;
  /** If true, a drop ends the active run. */
  stopOnDrop: boolean;
}

export const DEFAULT_CONFIG: TrackerConfig = {
  pHigh: 0.6,
  pLow: 0.15,
  refractorySec: 0.09,

  kConfirmIntervals: 3,
  kConfirmIntervalsWarm: 2,
  confirmTolerance: 0.3,
  stopAfterPeriods: 2.75,
  stopAfterMaxSec: 8.0,
  provisionalTimeoutSec: 4.0,
  minRunCatches: 4,
  firstThrowPolicy: "count",

  TMin: 0.12,
  TMax: 2.0,
  alphaT: 0.15,
  alphaSigma: 0.1,
  sigmaInitFrac: 0.08,
  sigmaMinFrac: 0.03,
  sigmaMaxFrac: 0.2,
  windowSigmas: 3,
  windowMinFrac: 0.15,
  windowMaxFrac: 0.45,
  warmPriorValiditySec: 300,

  backfillEnabled: true,
  backfillMaxGap: 1,
  backfillRequiresEvidence: true,
  backfillEvidenceMinP: 0.05,
  backfillEvidenceGuardSec: 0.12,
  backfillConfirmAfter: 2,

  pDropThreshold: 0.5,
  dropRefractorySec: 0.25,
  stopOnDrop: false,
};

// -- Events emitted by the tracker ---------------------------------------------

export type RunEndReason = "timeout" | "drop" | "flush";

export type TrackerEvent =
  | { type: "runStarted"; t: number; count: number }
  | { type: "catch"; t: number; count: number }
  /** Backfilled catches are committed late (after confirmation) and flagged,
   *  so the UI can signal them distinctly. `t` is the interpolated catch time. */
  | { type: "catchBackfilled"; t: number; count: number }
  | { type: "drop"; t: number }
  | {
      type: "runEnded";
      t: number;
      count: number;
      durationSec: number;
      meanPeriodSec: number;
      reason: RunEndReason;
    }
  /** Aborted starts / too-short runs. Hidden from normal view; debug only. */
  | { type: "runDiscarded"; t: number; count: number; reason: string };

/** Frame-level debug info, streamed (not stored) when a listener is attached. */
export interface DebugInfo {
  t: number;
  pCatch: number;
  mode: "idle" | "provisional" | "active";
  effectiveThreshold: number;
  inWindow: boolean;
  T: number | null;
  sigma: number | null;
  count: number;
}
