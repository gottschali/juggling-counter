<script lang="ts">
    import { Sequence } from "./lib/sequence";
    import { Confetti } from "svelte-confetti";
    import LogTable from "./components/LogTable.svelte";
    import Recorder from "./components/Recorder.svelte";
    import Upload from "./components/Upload.svelte";
    import IconButton from "./icons/IconButton.svelte";
    import GithubIcon from "./icons/GithubIcon.svelte";
    import InfoIcon from "./icons/InfoIcon.svelte";
    import SettingsIcon from "./icons/SettingsIcon.svelte";

    let count: number = $state(0);

    const setCount = (c: number) => {
        count = c;
    };
    const addSequence = (s: Sequence) =>
        (sequences = new Array(s, ...sequences));

    // could display live statistics for the current sequence
    // let sequence = $state(new Sequence());
    let sequences: Sequence[] = $state([]);
    // let debugSeq = $derived(JSON.stringify(sequence));
</script>

<main>
    <h1>Juggling Counter</h1>
    <!-- <div>
        <IconButton icon={GithubIcon} />
        <IconButton icon={InfoIcon} />
        <IconButton icon={SettingsIcon} />
    </div> -->
    <ul>
        <li>Count your juggling catches automatically based on audio only.</li>
        <li>
            Permission to access the microphone must be given. All processing
            happens on your device.
        </li>
        <li>
            Works only in quiet environment and if you juggle <i>loud</i> and
            <i>regular</i> enough.
        </li>
    </ul>
    <div>
        <Recorder {setCount} {addSequence} />
    </div>
    <div>
        <Upload {setCount} {addSequence} />
    </div>
    <div
        style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
    >
        {#if count % 10 == 0}
            <Confetti amount={count} rounded={true} />
        {/if}
    </div>
    <h2 title="current number of catches">{count}</h2>
    <LogTable {sequences} />
</main>

<style>
    main {
        text-align: center;
        padding: 20px;
    }
    li {
        /* TODO proper ball and size */
        list-style-image: url(/ball.svg);
        border-radius: 1ch;
        padding-inline: 1ch;
        margin-inline-end: 1ch;
    }
</style>
