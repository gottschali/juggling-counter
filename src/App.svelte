<script lang="ts">
    import { AnalyzeOffline, handleFileUpload } from "./lib/upload";
    import { Sequence } from "./lib/sequence";
    import { Confetti } from "svelte-confetti";
    import LogTable from "./components/LogTable.svelte";
    import MicrophoneCounter from "./components/MicrophoneCounter.svelte";

    let count: number = $state(0);
    let isFileLoaded = $state(false);
    let fileInput: HTMLInputElement;

    let uploadSupported = OfflineAudioContext.prototype.suspend === undefined

    const setCount = (c: number) => {
        count = c;
    };
    const addSequence = (s: Sequence) => sequences = new Array(s, ...sequences);

    // could display live statistics for the current sequence
    // let sequence = $state(new Sequence());
    let sequences: Sequence[] = $state([]);
    // let debugSeq = $derived(JSON.stringify(sequence));

    const submitFileUpload = async () => {
        const file = fileInput.files?.[0];
        if (file) {
            isFileLoaded = true
            const buffer = await handleFileUpload(file);
            const ctxt = new (window.AudioContext || (window as any).webkitAudioContext)()
            await AnalyzeOffline(ctxt, buffer, setCount,
             (s: Sequence) => {
                s.pattern = file.name
                s.endTime = s.time // not correct for uploaded
                addSequence(s)
             },
             OfflineAudioContext, true);
            isFileLoaded = false
        }
    };
</script>

<main>
    <h1>Juggling Counter</h1>
    <div>
        <MicrophoneCounter setCount={setCount} addSequence={addSequence} />
        <input
            type="file"
            bind:this={fileInput}
            accept="audio/*"
            onchange={submitFileUpload}
            disabled={uploadSupported}
        />
        <div
            style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
        >
            {#if count % 10 == 0 && !isFileLoaded}
                <Confetti amount={count} rounded={true} />
            {/if}
        </div>
    </div>
    <h2 title="current number of catches">{count}</h2>
    <LogTable {sequences} />
</main>

<style>
    main {
        text-align: center;
        padding: 20px;
    }
</style>
