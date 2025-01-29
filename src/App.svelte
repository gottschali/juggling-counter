<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { AudioProcessor, BeatTracker, handleFileUpload } from "./lib/audio";
    import Graph from "./components/Graph.svelte";
    import { Sequence } from "./lib/sequence";
    import { Confetti } from "svelte-confetti"

    let count: number = $state(0);
    let audioProcessor: AudioProcessor | null = $state(null);
    let frequencyData: Uint8Array = $state(new Uint8Array(0));
    let isRecording: boolean = $state(false);
    let isFileLoaded = false;
    let fileInput: HTMLInputElement;
    let tracker = new BeatTracker();
    let reqId = -1;

    let sequence = $state(new Sequence());
    let sequences: Sequence[] = $state([]);
    // let debugSeq = $derived(JSON.stringify(sequence));

    let calibrationCount = $state(0);
    const calibrationSamples = 100;

    onMount(() => {
        // audioProcessor = new AudioProcessor();
    });
    onDestroy(() => {
        if (audioProcessor) {
            audioProcessor.stopRecording();
        }
    });
    const toggleRecording = async () => {
        console.log("toggle recording");
        if (audioProcessor === null) {
            const ctxt = new (window.AudioContext || window.webkitAudioContext)();
            audioProcessor = new AudioProcessor(ctxt);
        }
        if (!isRecording) {
            audioProcessor
                .startRecording()
                .then(() => {
                    isRecording = true;
                    tracker.connect(audioProcessor!);
                    count = 0;
                    calibrationCount = 0;

                    processAudio();
                })
                .catch((err) => {
                    console.error(err);
                    alert("No permission to access the microphone.");
                });
        } else {
            isRecording = false;
            audioProcessor.stopRecording();
            cancelAnimationFrame(reqId);
            // console.log("measurements: ", tracker.x)
        }
    };

    const calibrations: number[][] = [];
    const processAudio = () => {
        if (!isRecording) return;
        if (audioProcessor === null) return;

        if (calibrationCount < calibrationSamples) {
            const data = audioProcessor.getFrequencyData();
            calibrations.push(Array.from(data));
            calibrationCount += 1;
        } else if (calibrationCount == calibrationSamples) {
            tracker.calibrateSilence(calibrations);
            calibrationCount += 1;
        }

        frequencyData = audioProcessor.getFrequencyData();
        tracker.update(frequencyData);
        sequence = tracker.currentSequence;
        sequences = tracker.sequences;
        count = sequence.events.length;
        reqId = requestAnimationFrame(processAudio);
    };
    const submitFileUpload = async () => {
        const file = fileInput.files?.[0];
        if (file) {
            frequencyData = await handleFileUpload(file);
            isFileLoaded = true;
        }
    };
</script>

<main>
    <h1>Juggling Counter</h1>
    <div>
        <button
            class={isRecording ? "record" : "norecord"}
            onclick={toggleRecording}
        >
            {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
        <!-- <input
            type="file"
            bind:this={fileInput}
            accept="audio/*"
            onchange={submitFileUpload}
        /> -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
            {#if count % 10 == 0}
            <Confetti amount={count} rounded={true}/>
            {/if}
        </div>
  
    </div>
    <h2>{count}</h2>
    <div style:justify-content="center">
        <table>
            <thead>
                <tr><td>time</td><td>n</td></tr>
            </thead>
            <tbody>
                {#each sequences as seq}
                    <tr>
                        <td>{seq.time.toLocaleTimeString()}</td>
                        <td>{seq.events.length}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    {#if frequencyData.length > 0}
        <Graph data={frequencyData} />
    {/if}
</main>

<style>
    main {
        text-align: center;
        padding: 20px;
    }
    button {
        padding: 10px 20px;
        margin: 10px;
        cursor: pointer;
    }
    button::before {
        content: " ● ";
    }
    button.record::before {
        color: var(--color);
    }
    input {
        margin: 10px;
    }
</style>
