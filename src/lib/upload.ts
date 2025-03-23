import { AudioPreparer } from "./AudioPreparer";
import { average, stdv } from "./mathUtils";
import type { Sequence } from "./sequence";
import { SequenceTracker } from "./SequenceTracker";
import { SimpleOnlinePeakDetector } from "./SimpleOnlinePeakDetector";

export async function handleFileUpload(file: File): Promise<ArrayBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return arrayBuffer;
}

export async function AnalyzeOffline(
    audioContext: AudioContext, // for node compatibility
    arrayBuffer: ArrayBuffer,
    setCount: (count: number) => void,
    addSequence: (seq: Sequence) => void,
    offlineCtxtCls: typeof OfflineAudioContext, // for node compatibility
    batchSize = 256,
) {
    // todo handle errors
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length
    const duration = audioBuffer.duration
    console.log(`uploaded audio file: ${duration}s, ${sampleRate}Hz`)

    const offlineCtxt = new offlineCtxtCls(audioBuffer.numberOfChannels, length, sampleRate);
    const source = offlineCtxt.createBufferSource();
    source.buffer = audioBuffer;

    const batchDuration = batchSize / sampleRate;
    
    const audioPreparer = new AudioPreparer(source);
    const totalBatches = Math.ceil(audioBuffer.length / batchSize);
    // source.connect(offlineCtxt.destination);
    // let time = 0;
    // suspend is not supported on Firefox
    // source.start(time)
    const values = new Array<number>()
    for (let i=0; i<totalBatches; i++) {
        offlineCtxt.suspend(i * batchDuration).then(()=> {
            const value = audioPreparer.process(batchSize)
            values.push(value)
        }).then(() => {
            offlineCtxt.resume()
        })
    }
    source.start(0)
    await offlineCtxt.startRendering()
    source.stop()
    const mean = average(values)
    const std  = stdv(values, mean)
    console.log(mean, std)
    const detector = new SimpleOnlinePeakDetector(batchDuration, mean + std / 2);
    const sequenceTracker = new SequenceTracker(
        detector,
        setCount,
        addSequence,
        batchDuration,
    );
    for (let i=0; i<values.length; i++) {
        sequenceTracker.update(values[i], false)
    }
    setCount(sequenceTracker.maxLength)
}

