export class AudioProcessor {
    private microphoneStream: MediaStream | null = null;

    async startRecording(sampleRate = 48000): Promise<MediaStreamAudioSourceNode> {
        const audioContext = new ((window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext)({ sampleRate });

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        this.microphoneStream = stream;
        const source = audioContext.createMediaStreamSource(stream);

        return source
    }
    stopRecording(): void {
        if (this.microphoneStream !== null) {
            this.microphoneStream.getTracks().forEach((track) => track.stop());
        }
    }
}