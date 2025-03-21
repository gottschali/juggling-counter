import { Sequence } from "./sequence";

export class AudioProcessor {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private microphoneStream: MediaStream | null = null;

    constructor(sampleRate=48000) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
        this.analyser = this.audioContext.createAnalyser();
    }
    getSampleRate(): number {
        return this.audioContext.sampleRate;
    }
    getFFTSize(): number {
        return this.analyser.fftSize;
    }
    async startRecording(): Promise<void> {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        this.microphoneStream = stream;
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.analyser.fftSize = 512; // FFT size for analyzing frequency data
        this.analyser.smoothingTimeConstant = 0.0;
    }
    stopRecording(): void {
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach((track) => track.stop());
            this.analyser.disconnect();
            // TODO we still get data?
        }
    }
    getFrequencyData(size: number | null = null): Uint8Array {
        const oldsize = this.getFFTSize();
        if (size !== null) {
            this.analyser.fftSize = size;
        }
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        this.analyser.fftSize = oldsize;
        return dataArray;
    }
}

// not used yet
export interface BeatTracker {
    update(data: Uint8Array): number
    currentSequence: Sequence
    sequences: Sequence[]
}


// For 3 ball cascase with beanbags i get
// µ=29.3  std=24.05
// Threshold shoud be at least the average
// For loud juggling, the peaks are pronounced are at least a standard deviation away.
// Unfortunately, silent catches in between stop the sequence.
export class RealtimeLocalMaxTracker implements BeatTracker {
    private previousPeakIndex: number;
    // A peak must exceed the value theshold
    private threshold: number = 45;
    private counter: number;
    // Minimum time between throws, in seconds
    private distanceSec = 0.15;
    private distance // in segments
    // The time after which a sequence is stopped after no new throws are detected, in seconds
    private stopSec = 0.6;
    private stop: number // in segments

    // Minimum number of events such that the sequence is logged
    private minSequenceLength = 3;

    // Processing
    private batchDuration = 0.0107 // = sampleRate / segmentSize
    // TODO getter
    public sequences: Sequence[];
    public currentSequence: Sequence;

    private window: number[];

    private vals: number[];

    constructor() {
        this.previousPeakIndex = 0;
        this.counter = 0;
        this.sequences = [];
        this.currentSequence = new Sequence();

        this.distance = this.convertSecondToSegements(this.distanceSec)
        this.stop = this.convertSecondToSegements(this.stopSec)
        this.window = new Array(Math.max(3, Math.ceil(this.distance / 2)))
        this.vals = []
    }

    private convertSecondToSegements(sec: number): number {
        return Math.round(sec / this.batchDuration)
    }

    connect(a: AudioProcessor) {
        const sr = a.getSampleRate();
        const batchSize = a.getFFTSize();
        this.batchDuration = batchSize / sr;

        this.distance = this.convertSecondToSegements(this.distanceSec)
        this.stop = this.convertSecondToSegements(this.stopSec)
        this.window = new Array(Math.max(3, Math.ceil(this.distance / 2)))
    }

    update(data: Uint8Array): number {
        // Average over all freqs to smooth the signal
        // Could select a frequency band. Using everything is quite robust.
        const slice = data.slice(10)
        const val = slice.reduce((sum, value) => sum + value, 0) / slice.length;
        this.vals.push(val)
        this.window.shift();
        this.window.push(val);
        this.counter += 1;
        // distance in number of segments to the previous peak
        const dist = this.counter - this.previousPeakIndex;

        if (dist >= this.stop) {
            // no peak detected for some time, this ends the previous sequence
            const enoughThrows =
                this.currentSequence.events.length >= this.minSequenceLength;
            if (enoughThrows) {
                this.sequences.push(this.currentSequence);
            }
            this.currentSequence = new Sequence();
        }

        if (val < this.threshold) {
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
            const avg = this.vals.reduce((sum, value) => sum + value, 0) / this.vals.length
            const std = stdv(this.vals, avg)
            console.debug("PEAK", this.counter, "val", val, "avg", avg, "std", std)
            this.currentSequence.add({
                'index': this.counter,
            })
            this.previousPeakIndex = this.counter
            return 1
        }

        return 0
    }
}

function stdv(xs: number[], mu: number): number {
    const variance = xs.map(x => (x - mu) ** 2).reduce((sum, v) => sum + v, 0) / xs.length;
    return Math.sqrt(variance);
}

export async function handleFileUpload(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext ||
            window.webkitAudioContext)();
        const reader = new FileReader();
        reader.onload = async () => {
            const buffer = await audioContext.decodeAudioData(
                reader.result as ArrayBuffer,
            );
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(analyser);
            analyser.fftSize = 256;
            source.start(0);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            resolve(dataArray);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}
