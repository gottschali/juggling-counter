# CLAUDE.md

Guide for continuing work on **juggling-counter**. Read this first when picking
up the project. It captures the architecture, the current state, and the
prioritized next steps.

## Project goal

Count juggling catches in real time from audio, reliably enough to be
"approximately right", running in-browser on a mid-range consumer phone,
offline-capable. The headline requirement: **a run must not stop mid-juggle**
because of a quiet catch or background noise.

## Stack

- Frontend: Svelte 5 + TypeScript + Vite. Tests: Vitest.
- Audio: Web Audio `AnalyserNode` (live) / `node-web-audio-api` (offline tests).
- Planned: React/TypeScript + Go backend (for sharing recordings / retraining).
  The tracker core is written to port cleanly to Go.

## Architecture (current)

Two detection paths, selected by `Controller.startRecording(..., detectorKind)`:

```
mic → AudioProcessor → AudioPreparer → scalar energy value per batch (~256 samples)
                                          │
              ┌───────────────────────────┴───────────────────────────┐
   detectorKind: "simple" (default)                 detectorKind: "rhythm"
   SimpleOnlinePeakDetector                          SignalAdapter (energy → pseudo-prob)
   → SequenceTracker                                 → JugglingTracker (state machine)
                                                     → TrackerBridge (→ setCount/addSequence)
```

### The rhythm tracker — `src/lib/tracker/`

This is the current focus. Files:

- **`tracker.ts`** — `JugglingTracker`, a **pure deterministic state machine**
  (idle → provisional → active). Consumes `Frame {t, pCatch, pDrop?}`, emits
  semantic events (`runStarted`, `catch`, `catchBackfilled`, `drop`,
  `runEnded`, `runDiscarded`). No audio/timers/UI. O(1) memory per run.
- **`types.ts`** — `TrackerConfig` (full parameter surface, documented) +
  `DEFAULT_CONFIG`, event union, `DebugInfo`. This config object is the source
  of truth for the planned expert-mode UI.
- **`SignalAdapter.ts`** — converts the legacy scalar energy signal into a
  pseudo-probability (asymmetric noise-floor EMA + logistic). Interim signal
  source; the ML model replaces *this*, not the tracker. Exposes `noiseFloor`.
- **`TrackerBridge.ts`** — maps tracker events onto the existing
  `setCount`/`addSequence`/`Sequence` interface.
- **`synth.ts`** — deterministic synthetic probability-stream generator. Stand-
  in for the ML model and a fuzzing harness for parameter sweeps.
- **`tracker.test.ts`** — 13 vitest cases. Keep these green.

### Key design principles (do not regress)

- **Tracker stays signal-source-agnostic and pure.** Audio/model/UI never leak
  into it. This is what makes it testable, replayable, and Go-portable.
- **The ML model stays dumb; juggling knowledge lives in the tracker.** Bias
  the model toward recall; the tracker's timing gate kills false positives.
- **False positives are cheap, misses are expensive.** A missed catch can end a
  run (the cardinal sin); a stray detection gets gated out by the period model.
- **Backfill must never inflate counts at run end.** Uncommitted backfills die
  with the run. There is a test for this; keep it.
- **Time-like parameters are period-relative** (units of T) where possible, so
  slow club juggling and fast bag flashing share one parameter set.

## Commands

```bash
npm install
npm run dev                          # live app
npx vitest run src/lib/tracker       # tracker tests (should be 13/13 green)
npx tsc --noEmit -p tsconfig.app.json
npx vitest run                       # full suite — see known issue below
```

### Known issue

`src/lib/analyze.test.ts` (audio decoding via `node-web-audio-api`) fails in
some environments independent of tracker changes. Verify against unmodified
`main` before assuming a regression: `git stash && npx vitest run && git stash pop`.

---

## TODO — prioritized

### P0 — Validate the rhythm tracker on real audio

The `SignalAdapter` defaults (`zMid: 3`, `zScale: 1.5`) are untuned guesses.
Nothing has been verified against real recordings yet.

- [ ] Build an **offline replay harness**: decode a `data/*.wav|mp3`, run it
      through `AudioPreparer` → `SignalAdapter` → `JugglingTracker`, output the
      run counts. Mirror `analyze.ts`'s decode path.
- [ ] Compare rhythm-path counts against the known truths in `analyze.test.ts`
      (`3b6c`→6, `5b10c`→10, `loud3b15c`→15, `fast3b15c`→15, `slow3b`→15,
      `3b3x3`→[3,3,3]). Add as vitest cases for the rhythm path.
- [ ] Tune `SignalAdapter` + `TrackerConfig` against these. The replay harness
      is also the parameter-sweep loop (try N configs, report count error).
- [ ] Sanity-check the `3b3x3` multi-run case end-to-end (3 separate runs).

### P1 — Expert-mode UI

- [ ] Parameter panel driven by `TrackerConfig` (group by concern as in
      `types.ts`: thresholds / lifecycle / period / backfill / drops).
- [ ] Detector toggle: `simple` vs `rhythm`.
- [ ] Debug view consuming the `DebugInfo` stream (live plot of pCatch,
      effective threshold, predicted window, T, σ, count). Stream-only, not
      stored — wire `onDebug` into `TrackerBridge`/`Controller` (currently the
      bridge accepts it but Controller doesn't pass one through; add that).
- [ ] Backfill indicator: visually flag `catchBackfilled` events distinctly
      from `catch` in the counter UI.

### P2 — Calibration flow

A 10–15 s ritual ("juggle ~10 catches quietly"). Produces:

- [ ] **Spectral prop template**: mean mel spectrum over detected catch frames.
      At runtime, gate/scale probability by cosine similarity to the template
      (cheap matched filter; adapts to silicone balls vs beanbags vs clubs
      without retraining). Needs spectral data, so likely lands with the ML
      feature pipeline (P3).
- [ ] **Noise-floor capture** + runtime monitoring: if the running noise floor
      (from `SignalAdapter.noiseFloor` or the model's background class) exceeds
      the calibrated floor by a margin for a sustained duration, surface a
      "conditions changed — recalibrate?" prompt. Keep running with the old
      profile until the user accepts. New params: margin (dB), persistence (s).
- [ ] **Initial period seed**: feed the calibration tempo as a warm prior so
      the first real run locks on faster.

### P3 — ML onset model (the main reliability upgrade)

Replaces `SignalAdapter` with a real frame-level classifier. Tracker unchanged.

- [ ] **Data**: record ~1 hr clean catches (a few props, distances, tempos;
      floor + table mic placement). ~10 min drops on different surfaces.
      Deliberate negatives (speech, claps, walking, phone set-down). A few
      "known exact count" runs as an end-to-end test set.
- [ ] **Labels**: bootstrap onsets with the current detector on clean audio,
      hand-correct (Audacity label tracks). Soften each onset to a small
      Gaussian target (±2–3 frames).
- [ ] **Features**: 16 kHz mono, log-mel or **PCEN** (~32–40 bands, 25 ms win,
      10 ms hop), ±~7 frame context. Consider baking feature extraction into
      the ONNX graph so JS feeds raw PCM.
- [ ] **Model**: tiny CNN (Schlüter/Böck style), 3-class head
      **catch / drop / background**, ~20–80k params, int8 → <100 KB. This is
      where `pDrop` becomes real (and `stopOnDrop` / drop-ends-run gets used).
- [ ] **Augmentation** (scoped to "quiet room, some speech/music"): mix speech
      + quiet music at SNR +5..+20 dB, light reverb, gain jitter, AAC codec sim.
      Skip extreme 0 dB street noise (explicitly out of scope).
- [ ] **Deploy**: PyTorch → ONNX → `onnxruntime-web` (WASM + SIMD; do NOT rely
      on WebGPU — iOS Safari flaky). Capture PCM via `AudioWorklet`. Wire output
      into the tracker via a new model-backed signal source (parallel to
      `SignalAdapter`, same `{t, pCatch, pDrop}` contract).
- [ ] **Eval**: onset F1 @ ±50 ms tolerance **and** end-to-end count error /
      run-survival on the known-count set. Split by session + device, never by
      random frames. Pick the operating point from run-survival, not raw F1.

### P4 — Recording sharing + retraining (needs Go backend)

- [ ] Opt-in "share this recording to improve detection" after a run.
- [ ] Go backend: store shared recordings + (optional) user-confirmed counts as
      weak labels. Retraining pipeline.
- [ ] Server-side re-analysis: port/run the tracker in Go over uploaded audio.

### P5 — Non-uniform rhythms (siteswaps)

Current period model assumes evenly spaced catches (true for cascade/fountain,
false for e.g. 531 or anything with a 0/2). The state machine was designed so
this slots in later.

- [ ] **Cyclic interval pattern**: after a few cycles, learn the repeating
      sequence of inter-catch gaps instead of a single T; predict windows from
      the phase within the cycle.
- [ ] **Declared siteswap** (expert feature): user enters the pattern; derive
      the expected catch rhythm from it. (Note: the catch-time structure is
      derivable from the siteswap — natural fit for the maintainer's siteswap
      theory work.)
- [ ] **Temporal tempo updates within a run** (currently "one run ≈ one tempo"
      is assumed acceptable; revisit only if needed).

## Open decisions parked for later

- Backfill UX when count jumps late (by design): how prominently to signal it.
- Whether the displayed count may revise downward (e.g. trailing events
  reclassified as drops at run end) or stays append-only. Currently effectively
  append-only; revisit with the drop model (P3).
- First-throw convention default (`count` vs `ignoreFirst`) — decide empirically
  once P0 validation tells us which matches the known-count truths.
