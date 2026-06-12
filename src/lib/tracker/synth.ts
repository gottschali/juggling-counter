// Synthetic detector-output generator. Produces the probability stream a
// frame-level model would emit: Gaussian bumps at catch/drop times over a
// noise floor. Lets us test the tracker before any ML exists, and later
// doubles as a fuzzing harness (sweep jitter/miss-rate/noise vs. parameters).

import type { Frame } from "./types";

export interface BumpSpec {
  t: number;
  /** Peak probability of the bump. */
  height: number;
  /** Gaussian std in seconds (transients ~ 0.02–0.04). */
  widthSec?: number;
  channel?: "catch" | "drop";
}

export interface SynthOptions {
  durationSec: number;
  /** Frame rate of the detector output (model hop rate), Hz. */
  frameRateHz?: number;
  /** Baseline noise on pCatch (uniform in [0, noiseFloor]). */
  noiseFloor?: number;
  seed?: number;
}

/** Deterministic LCG so tests are reproducible. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function synthesize(bumps: BumpSpec[], opts: SynthOptions): Frame[] {
  const fr = opts.frameRateHz ?? 100;
  const noise = opts.noiseFloor ?? 0.02;
  const rng = makeRng(opts.seed ?? 1);
  const n = Math.ceil(opts.durationSec * fr);
  const frames: Frame[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / fr;
    let pCatch = rng() * noise;
    let pDrop = 0;
    for (const b of bumps) {
      const w = b.widthSec ?? 0.025;
      if (Math.abs(t - b.t) > 4 * w) continue;
      const v = b.height * Math.exp(-((t - b.t) ** 2) / (2 * w * w));
      if ((b.channel ?? "catch") === "catch") pCatch = Math.max(pCatch, v);
      else pDrop = Math.max(pDrop, v);
    }
    frames.push({ t, pCatch: Math.min(pCatch, 1), pDrop });
  }
  return frames;
}

/** Convenience: a periodic run of catches with optional timing jitter. */
export function periodicRun(opts: {
  start: number;
  T: number;
  nCatches: number;
  height?: number;
  jitterSec?: number;
  seed?: number;
}): BumpSpec[] {
  const rng = makeRng(opts.seed ?? 7);
  const bumps: BumpSpec[] = [];
  for (let i = 0; i < opts.nCatches; i++) {
    const jitter = opts.jitterSec ? (rng() * 2 - 1) * opts.jitterSec : 0;
    bumps.push({ t: opts.start + i * opts.T + jitter, height: opts.height ?? 0.9 });
  }
  return bumps;
}
