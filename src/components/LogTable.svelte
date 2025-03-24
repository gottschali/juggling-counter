<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import DeleteIcon from "../icons/DeleteIcon.svelte";
    import { average, stdv } from "../lib/mathUtils";
    import type { Sequence } from "../lib/sequence";

    let { sequences, deleteSequence } = $props();

    function mu(s: Sequence): number {
        const indices = s.getEvents().map((e) => e.index);
        const differences = indices
            .slice(1)
            .map((index, i) => index - indices[i]);
        let m = average(differences);
        if (s.meta.batchDuration) {
            m *= s.meta.batchDuration;
        }
        return m;
    }
    function sigma(s: Sequence): number {
        const indices = s.getEvents().map((e) => e.index);
        const differences = indices
            .slice(1)
            .map((index, i) => index - indices[i]);
        let std = stdv(differences);
        if (s.meta.batchDuration) {
            std *= s.meta.batchDuration;
        }
        return std;
    }
</script>

<div style:justify-content="center" class="flex-container">
    {#if sequences.length > 0}
        <table>
            <caption>Practice Log</caption>
            <thead>
                <tr>
                    <th title="length of the juggling sequence (in seconds)"
                        >t</th
                    >
                    <th title="number of catches in the sequence">n</th>
                    <th title="average time between catches (in seconds)">µ</th>
                    <th
                        title="standard devition of time between catches (in seconds)"
                        >σ</th
                    >
                    <th title="custom pattern of the name of the uploaded file"
                    ></th>
                    <th title="delete a sequence">x</th>
                </tr>
            </thead>
            <tbody>
                <!-- idea: add a divider or sth when the pattern changes-->
                {#each sequences as seq, i (i)}
                    <tr out:fade>
                        <td title={seq.time.toLocaleTimeString()}
                            >{((seq.endTime - seq.time) / 1000).toFixed(2)}s</td
                        >
                        <td>{seq.length}</td>
                        <td>{mu(seq).toFixed(2)}</td>
                        <td>{sigma(seq).toFixed(2)}</td>
                        <td>{seq.pattern}</td>
                        <td onclick={() => deleteSequence(i)}><DeleteIcon /></td
                        >
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .flex-container {
        display: flex;
        justify-content: center;
        align-items: center;
    }
    table {
        display: table;
        border-spacing: 2px;
        border-collapse: separate;
        box-sizing: border-box;
        text-indent: 0;
    }

    td {
        font-family: "Open Sans", sans-serif;
        line-height: 1.5;
    }

    thead {
        border-block-end: 2px solid;
    }

    th,
    td {
        border-bottom: 1px solid #f9f9f9;
    }
</style>
