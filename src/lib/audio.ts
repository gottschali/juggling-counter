import { Sequence } from "./sequence";

export class AudioProcessor {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private microphoneStream: MediaStream | null = null;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
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
        this.analyser.fftSize = 256; // FFT size for analyzing frequency data
        this.analyser.smoothingTimeConstant = 0.8;
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

export class BeatTracker {
    private previousPeak: number;
    private threshold: number = 35;
    private peakLength: number;
    private counter: number;
    // Minimum time between throws, in seconds
    private minDistance = 0.15; // 15;
    // Minimum duration of a peak, in seconds
    private minWidth = 0.01; // 5;
    // The time after which a sequence is stopped after no new throws are detected, in seconds
    private sequenceTermination = 0.6; // 80;
    // Minimum number of events such that the sequence is logged
    private minSequenceLength = 3;

    private audioProcessor: AudioProcessor | undefined;
    // Processing
    private batchDuration = 0;
    // TODO getter
    public sequences: Sequence[];
    public currentSequence: Sequence;
    
    constructor() {
        // this.threshold = threshold
        this.previousPeak = 0;
        this.counter = 0;
        this.peakLength = 0;
        this.sequences = [];
        this.currentSequence = new Sequence();
    }
    connect(a: AudioProcessor) {
        this.audioProcessor = a;

        const sr = a.getSampleRate();
        const batchSize = a.getFFTSize();
        this.batchDuration = batchSize / sr;
    }
    calibrateSilence(calibrations: number[][]) {
        let s = 0;
        let m = 0;
        for (let i = 0; i < calibrations.length; i += 1) {
            const subarray = calibrations[i].slice(0, 64); // TODO
            const val =
                subarray.reduce((sum, value) => sum + value, 0) /
                subarray.length;
            s += val;
            console.debug("calibration: ", val);
            m = Math.max(m, val);
        }
        console.log("final: ", s / calibrations.length);
        console.log("max: ", m);
    }
    update(data: Uint8Array): number {
        // convert to number of chunks
        const delta = Math.round(this.minDistance / this.batchDuration);
        const width = Math.round(this.minWidth / this.batchDuration);
        const tooLong = Math.round(
            this.sequenceTermination / this.batchDuration,
        );
        // select freqs
        const subArray = data.slice(54, 64);
        const val =
            subArray.reduce((sum, value) => sum + value, 0) / subArray.length;
        this.counter += 1;
        // console.debug("update: ", this.counter, val)

        // distance in number of chunks to the previous peak
        const dist = this.counter - this.previousPeak;

        const restart = dist >= tooLong;
        if (restart) {
            const enoughThrows =
                this.currentSequence.events.length >= this.minSequenceLength;
            if (enoughThrows) {
                this.sequences.push(this.currentSequence);
            }
            this.currentSequence = new Sequence();
        }
        const peaking = val >= this.threshold;
        const peakActive = this.peakLength > 0;
        if (peaking && peakActive) {
            // extend the current peak
            this.peakLength += 1;
            // TODO: if its too long, warn (or maybe even adjust threshold?)
        } else if (peaking && dist >= delta) {
            // start a new peak
            this.peakLength = 1;
            console.log("new peak ", dist * this.batchDuration);
        } else if (peaking) {
            console.log("too quick ", dist * this.batchDuration);
        } else if (!peaking && this.peakLength >= width) {
            // STOP the peak
            console.log(
                "peak",
                dist * this.batchDuration,
                this.peakLength * this.batchDuration,
            );
            this.currentSequence.add({
                end: this.counter,
                length: this.peakLength,
            });
            this.previousPeak = this.counter;
            this.peakLength = 0;
            return 1;
        } else {
            this.peakLength = 0;
        }
        return 0;
    }
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
