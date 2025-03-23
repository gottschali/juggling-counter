import { AudioPreparer } from "./AudioPreparer";
import { AudioProcessor } from "./AudioProcessor";
import type { PeakDetector } from "./PeakDetector";
import type { Sequence } from "./sequence";
import { SequenceTracker } from "./SequenceTracker";
import { SimpleOnlinePeakDetector } from "./SimpleOnlinePeakDetector";

// todo better name
export class Controller {
    audioProcessor: AudioProcessor | null = null
    detector: PeakDetector | null = null;
    audioPreparer: AudioPreparer | null = null
    batchSize: number | null = null
    setCount!: (count: number) => void;
    addSequence!: (seq: Sequence) => void;
    sequenceTracker!: SequenceTracker;

    async startRecording(
        setCount: (count: number) => void,
        addSequence: (seq: Sequence) => void,
        batchSize = 512,
        sampleRate = 48000,
    ): Promise<any> {
        this.batchSize = batchSize
        this.audioProcessor = new AudioProcessor()
        const mediaStream = await this.audioProcessor.startRecording()
        this.audioPreparer = new AudioPreparer(mediaStream)
        const batchDuration = this.batchSize / sampleRate
        this.detector = new SimpleOnlinePeakDetector(batchDuration)
        this.sequenceTracker = new SequenceTracker(
            this.detector,
            setCount,
            addSequence,
            batchDuration,
        )
    }

    processAudio(batchSize = 512) {
        const value = this.audioPreparer!.process(batchSize)
        this.sequenceTracker.update(value)
    }

    stopRecording() {
        if (this.audioProcessor !== null) {
            this.audioProcessor.stopRecording()
        }
    }
}