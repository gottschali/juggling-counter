<script lang="ts">
    import UploadIcon from "../icons/UploadIcon.svelte";
    import { Sequence } from "../lib/sequence";

    let { setCount, addSequence } = $props();
    let fileInput: HTMLInputElement;
    import { AnalyzeOffline } from "../lib/SimpleOfflinePeakDetector";
    const handleFileUpload = async function (file: File): Promise<ArrayBuffer> {
        const arrayBuffer = await file.arrayBuffer();
        return arrayBuffer;
    };
    const submitFileUpload = async () => {
        try {
            OfflineAudioContext.prototype.suspend(0)
        } catch (e) {
            alert("Unfortunately this feature is not supported in your browser." +
            "https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/suspend#browser_compatibility")
        }
        const file = fileInput.files?.[0];
        if (file) {
            const buffer = await handleFileUpload(file);
            const ctxt = new (window.AudioContext ||
                (window as any).webkitAudioContext)();
            await AnalyzeOffline(
                ctxt,
                buffer,
                setCount,
                (s: Sequence) => {
                    s.pattern = file.name;
                    s.endTime = s.time; // not correct for uploaded
                    addSequence(s);
                },
                OfflineAudioContext,
                true,
            );
        }
    };
</script>
<label
    for="file-upload"
    class="custom-file-upload"
    title="upload an audio recording to count the number of throws"
>
    <span class="icon-button"><UploadIcon /></span>
    Upload File
</label>
<input
    id="file-upload"
    type="file"
    bind:this={fileInput}
    accept="audio/*"
    onchange={submitFileUpload}
/>
<style>
    input[type="file"] {
        display: none;
    }
    .custom-file-upload {
        border-radius: 8px;
        border: 1px solid transparent;
        padding: 10px 20px;
        margin: 10px;
        font-size: 1em;
        font-weight: 500;
        font-family: inherit;
        background-color: #1a1a1a;
        cursor: pointer;
        transition: border-color 0.25s;
    }
    .custom-file-upload:hover {
        border-color: #646cff;
    }
    .custom-file-upload:focus,
    .custom-file-upload:focus-visible {
        outline: 4px auto -webkit-focus-ring-color;
    }

    @media (prefers-color-scheme: light) {
        .custom-file-upload {
            background-color: #f9f9f9;
        }
    }
</style>
