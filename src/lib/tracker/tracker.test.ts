import { describe, expect, test } from "vitest";
import { JugglingTracker } from "./tracker";
import { periodicRun, synthesize, type BumpSpec } from "./synth";
import type { TrackerConfig, TrackerEvent } from "./types";

function run(bumps: BumpSpec[], durationSec: number, cfg: Partial<TrackerConfig> = {}) {
    const tracker = new JugglingTracker(cfg);
    const frames = synthesize(bumps, { durationSec, seed: 42 });
    const events: TrackerEvent[] = [];
    for (const f of frames) events.push(...tracker.update(f));
    events.push(...tracker.flush(durationSec));
    return events;
}

const runsEnded = (ev: TrackerEvent[]) =>
    ev.filter((e): e is Extract<TrackerEvent, { type: "runEnded" }> => e.type === "runEnded");

describe("JugglingTracker", () => {
    test("clean run: 30 catches at T=0.35", () => {
        const ev = run(periodicRun({ start: 1, T: 0.35, nCatches: 30, jitterSec: 0.02 }), 15);
        const ends = runsEnded(ev);
        expect(ends).toHaveLength(1);
        expect(ends[0].count).toBe(30);
        expect(ev.some((e) => e.type === "runStarted")).toBe(true);
        expect(ends[0].meanPeriodSec).toBeCloseTo(0.35, 1);
    });

    test("quiet catch inside predicted window (p < pHigh) is still counted", () => {
        const bumps = periodicRun({ start: 1, T: 0.35, nCatches: 20 });
        bumps[10].height = 0.3;
        const ev = run(bumps, 12);
        expect(runsEnded(ev)[0].count).toBe(20);
        expect(ev.some((e) => e.type === "catchBackfilled")).toBe(false);
    });

    test("missed catch with tiny evidence bump is backfilled", () => {
        const bumps = periodicRun({ start: 1, T: 0.35, nCatches: 20 });
        bumps[10].height = 0.1;
        const ev = run(bumps, 12);
        expect(ev.filter((e) => e.type === "catchBackfilled")).toHaveLength(1);
        expect(runsEnded(ev)[0].count).toBe(20);
    });

    test("missed catch with no evidence is not backfilled", () => {
        const bumps = periodicRun({ start: 1, T: 0.35, nCatches: 20 });
        bumps[10].height = 0.0;
        const ev = run(bumps, 12);
        expect(ev.some((e) => e.type === "catchBackfilled")).toBe(false);
        expect(runsEnded(ev)[0].count).toBe(19);
    });

    test("backfill at end of run never commits", () => {
        const bumps = periodicRun({ start: 1, T: 0.35, nCatches: 12 });
        bumps.push({ t: 1 + 12 * 0.35, height: 0.1 });
        const ev = run(bumps, 12);
        expect(ev.some((e) => e.type === "catchBackfilled")).toBe(false);
        expect(runsEnded(ev)[0].count).toBe(12);
    });

    test("off-beat false positive during a run is rejected", () => {
        const bumps = periodicRun({ start: 1, T: 0.4, nCatches: 15 });
        bumps.push({ t: 1 + 5.5 * 0.4, height: 0.5 });
        const ev = run(bumps, 12);
        expect(runsEnded(ev)[0].count).toBe(15);
    });

    test("isolated noise spikes never confirm a run", () => {
        const bumps: BumpSpec[] = [
            { t: 1.0, height: 0.8 },
            { t: 3.7, height: 0.7 },
            { t: 9.2, height: 0.9 },
        ];
        const ev = run(bumps, 12);
        expect(runsEnded(ev)).toHaveLength(0);
        expect(ev.some((e) => e.type === "runDiscarded")).toBe(true);
    });

    test("drop ends run when stopOnDrop=true", () => {
        const bumps = periodicRun({ start: 1, T: 0.35, nCatches: 30 });
        bumps.push({ t: 1 + 9.6 * 0.35, height: 0.9, channel: "drop" });
        const ev = run(bumps, 15, { stopOnDrop: true });
        const ends = runsEnded(ev);
        expect(ends[0].reason).toBe("drop");
        expect(ends[0].count).toBe(10);
        expect(ev.some((e) => e.type === "drop")).toBe(true);
    });

    test("drop does not end run when stopOnDrop=false", () => {
        const bumps = periodicRun({ start: 1, T: 0.35, nCatches: 30 });
        bumps.push({ t: 1 + 9.6 * 0.35, height: 0.9, channel: "drop" });
        const ev = run(bumps, 15, { stopOnDrop: false });
        expect(runsEnded(ev)[0].count).toBe(30);
    });

    test("two runs in a session both count correctly (warm prior)", () => {
        const bumps = [
            ...periodicRun({ start: 1, T: 0.35, nCatches: 15 }),
            ...periodicRun({ start: 12, T: 0.35, nCatches: 15 }),
        ];
        const ev = run(bumps, 20);
        const ends = runsEnded(ev);
        expect(ends).toHaveLength(2);
        expect(ends.map((e) => e.count)).toEqual([15, 15]);
    });

    test("slow tempo drift is tracked", () => {
        const bumps: BumpSpec[] = [];
        let t = 1;
        for (let i = 0; i < 40; i++) {
            bumps.push({ t, height: 0.9 });
            t += 0.35 + (0.07 * i) / 40;
        }
        const ev = run(bumps, 25);
        expect(runsEnded(ev)[0].count).toBe(40);
    });

    test("ignoreFirst policy subtracts the launch", () => {
        const ev = run(periodicRun({ start: 1, T: 0.35, nCatches: 20 }), 12, {
            firstThrowPolicy: "ignoreFirst",
        });
        expect(runsEnded(ev)[0].count).toBe(19);
    });

    test("slow club tempo (T=1.0) works with period-relative timeouts", () => {
        const ev = run(periodicRun({ start: 1, T: 1.0, nCatches: 10 }), 15);
        expect(runsEnded(ev)[0].count).toBe(10);
    });
});
