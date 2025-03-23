<script lang="ts">
    import { AnalyzeOffline, handleFileUpload } from "./lib/upload";
    import Graph from "./components/Graph.svelte";
    import { Sequence } from "./lib/sequence";
    import { Confetti } from "svelte-confetti";
    import LogTable from "./components/LogTable.svelte";
    import MicrophoneCounter from "./components/MicrophoneCounter.svelte";

    let count: number = $state(0);
    let frequencyData: Uint8Array = $state(new Uint8Array(0));
    let isFileLoaded = false;
    let fileInput: HTMLInputElement;

    let uploadSupported = OfflineAudioContext.prototype.suspend === undefined

    const setCount = (c: number) => {
        count = c;
    };
    const addSequence = (s: Sequence) => sequences.push(s);

    // could display live statistics for the current sequence
    // let sequence = $state(new Sequence());
    let sequences: Sequence[] = $state([]);
    // let debugSeq = $derived(JSON.stringify(sequence));

    const submitFileUpload = async () => {
        const file = fileInput.files?.[0];
        if (file) {
            const buffer = await handleFileUpload(file);
            await AnalyzeOffline(buffer, setCount, addSequence);
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
            {#if count % 10 == 0}
                <Confetti amount={count} rounded={true} />
            {/if}
        </div>
    </div>
    <h2>{count}</h2>
    <LogTable {sequences} />
    {#if frequencyData.length > 0}
        <Graph data={frequencyData} />
    {/if}
</main>

<style>
    main {
        text-align: center;
        padding: 20px;
    }
</style>
