import { AudioContext, OfflineAudioContext } from 'node-web-audio-api';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AnalyzeOffline } from "./upload";
import { Sequence } from "./sequence";

// npx tsx analyze.ts

async function createSource(filePath: string, ctxt: AudioContext): Promise<AudioBufferSourceNode> {
    const buf = readFileSync(filePath)
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const audioBuffer = await ctxt.decodeAudioData(arrayBuffer as ArrayBuffer)
    console.log(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate, audioBuffer.duration);
    const src = ctxt.createBufferSource();
    src.buffer = audioBuffer;
    return src
}

export async function sequences(filePath: string) : Promise<Sequence[]> {
    const buf = readFileSync(filePath)
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    let seqs: Sequence[] = [];
    const ctxt = new AudioContext();
    await AnalyzeOffline(
        ctxt,
        arrayBuffer as ArrayBuffer,
        (c) => {},
        (seq) => seqs.push(seq),
        OfflineAudioContext
    );
    ctxt.close()
    return seqs
}

export async function countThrows(filePath: string): Promise<number> {
    const seqs = await sequences(filePath)
    let throws = 0;
    seqs.forEach((s: Sequence) => {
        console.log(s)
        throws += s.length
    })
    console.log("final count: ", throws)
    return throws
}

// audio at filePath
// playback and obtain the frequency data via the web-audio api
async function simulateFFT(filePath: string): Promise<number[][]> {
    const ctxt = new AudioContext();
    const src = await createSource(filePath, ctxt)
    const analyser = ctxt.createAnalyser();
    analyser.fftSize = 256; // FFT size for analyzing frequency data
    analyser.smoothingTimeConstant = 0.0;
    src.connect(analyser)
    src.start();
    const freqs = new Array<Array<number>>();
    const bins = new Uint8Array(analyser.frequencyBinCount);
    for (let i = 0; i < src.buffer?.length!; i += analyser.fftSize) {
        analyser.getByteFrequencyData(bins);
        freqs.push(Array.from(bins))
        // sleep for 5.8 ms (depends on samplerate and fftsize?)
        await new Promise(resolve => setTimeout(resolve, 5.804988662131519));
    }
    src.stop()
    ctxt.close()
    const jsonFreqs = JSON.stringify(freqs);
    const baseName = path.basename(filePath, path.extname(filePath));
    const jsonFileName = `${baseName}.json`;
    writeFileSync(jsonFileName, jsonFreqs, 'utf8');
    return freqs;
}
