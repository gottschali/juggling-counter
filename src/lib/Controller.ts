import { AudioPreparer } from "./AudioPreparer";
import { AudioProcessor } from "./AudioProcessor";
import type { PeakDetector } from "./PeakDetector";
import type { Sequence } from "./sequence";
import { SequenceTracker } from "./SequenceTracker";
import { SimpleOnlinePeakDetector } from "./SimpleOnlinePeakDetector";
import { TrackerBridge } from "./tracker/TrackerBridge";
import type { TrackerConfig } from "./tracker/types";

export type DetectorKind = "simple" | "rhythm";

// todo better name
export class Controller {
    audioProcessor: AudioProcessor | null = null
    detector: PeakDetector | null = null;
    audioPreparer: AudioPreparer | null = null
    batchSize: number | null = null
    setCount!: (count: number) => void;
    addSequence!: (seq: Sequence) => void;
    sequenceTracker: SequenceTracker | null = null;
    trackerBridge: TrackerBridge | null = null;

    async startRecording(
        setCount: (count: number) => void,
        addSequence: (seq: Sequence) => void,
        batchSize = 256,
        sampleRate = 48000,
        detectorKind: DetectorKind = "simple",
        trackerConfig: Partial<TrackerConfig> = {},
    ): Promise<any> {
        this.batchSize = batchSize
        this.audioProcessor = new AudioProcessor()
        const mediaStream = await this.audioProcessor.startRecording()
        this.audioPreparer = new AudioPreparer(mediaStream)
        const batchDuration = this.batchSize / sampleRate
        if (detectorKind === "rhythm") {
            this.trackerBridge = new TrackerBridge(
                setCount,
                addSequence,
                batchDuration,
                trackerConfig,
            )
            this.sequenceTracker = null
        } else {
            this.detector = new SimpleOnlinePeakDetector(batchDuration, { dynamicThreshold: true })
            this.sequenceTracker = new SequenceTracker(
                this.detector,
                setCount,
                addSequence,
                batchDuration,
            )
            this.trackerBridge = null
        }
    }

    processAudio(batchSize = 256) {
        const value = this.audioPreparer!.process(batchSize)
        if (this.trackerBridge !== null) {
            this.trackerBridge.update(value)
        } else {
            this.sequenceTracker!.update(value)
        }
    }

    stopRecording() {
        if (this.trackerBridge !== null) {
            this.trackerBridge.stop()
        }
        if (this.audioProcessor !== null) {
            this.audioProcessor.stopRecording()
        }
    }
}
