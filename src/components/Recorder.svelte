<script lang="ts">
    import { onDestroy } from "svelte";
    import { Controller } from "../lib/Controller";
    import type { Sequence } from "../lib/sequence";

    let { setCount, addSequence } = $props();
    let isRecording: boolean = $state(false);
    let pattern = $state("")
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
                    (s: Sequence) => {
                        s.pattern = pattern
                        addSequence(s)
                    },
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
<form>
    <input bind:value={pattern} placeholder="Enter a pattern name"/>
</form>
<style>
    button, input {
        padding: 10px 20px;
        margin: 5px;
        cursor: pointer;
    }
    button::before {
        content: " ● ";
    }
    button.record::before {
        color: var(--color);
    }
</style>