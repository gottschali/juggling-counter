import type { MediaStreamAudioSourceNode } from "node-web-audio-api";

export class AudioPreparer {
    private analyser: AnalyserNode;

    constructor(source: MediaStreamAudioSourceNode | AudioBufferSourceNode) {
        this.analyser = source.context.createAnalyser()
        this.analyser.smoothingTimeConstant = 0.0;
        source.connect(this.analyser)
    }

    process(batchSize: number): number {
        this.analyser.fftSize = batchSize;
        const bufferLength = this.analyser.frequencyBinCount;
        const data = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(data);
        const slice = data.slice(10)
        const val = slice.reduce((sum, value) => sum + value, 0) / slice.length;
        return val;
    }
}