<script lang="ts">
    import { onDestroy } from "svelte";
    import { Controller } from "../lib/Controller";

    let isRecording: boolean = $state(false);
    let { setCount, addSequence } = $props();
    let reqId = -1;
    let batchSize = 512;
    let sampleRate = 48000;

    const controller = new Controller();
    
    const toggleRecording = async () => {
        console.log("toggle recording");
        const processAudio = () => {
            if (!isRecording) return;
            controller.processAudio()
            reqId = requestAnimationFrame(processAudio);
        };

        if (!isRecording) {
            controller
                .startRecording(
                    setCount,
                    addSequence,
                    batchSize,
                    sampleRate,
                )
                .then(() => {
                    isRecording = true;
                    setCount(0)
                    processAudio();
                })
                .catch((err) => {
                    console.error(err);
                    alert(`An error occurred: ${err}`);
                });
        } else {
            isRecording = false;
            controller.stopRecording();
            cancelAnimationFrame(reqId);
        }
    };

    onDestroy(() => {
        controller.stopRecording();
    });

    
</script>

<button
class={isRecording ? "record" : "norecord"}
onclick={toggleRecording}
>
{isRecording ? "Stop Recording" : "Start Recording"}
</button>

<style>
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
</style>