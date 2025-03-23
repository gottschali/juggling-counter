<script lang="ts">
    import { average, stdv } from "../lib/mathUtils";
    import type { Sequence } from "../lib/sequence";

    let { sequences } = $props();

    function mu(s: Sequence): number {
        const indices = s.getEvents().map(e => e.index);
        const differences = indices.slice(1).map((index, i) => index - indices[i]);
        let m = average(differences)
        if (s.meta.batchDuration) {
            m *= s.meta.batchDuration
        }
        return m
    }
    function sigma(s: Sequence): number {
        const indices = s.getEvents().map(e => e.index);
        const differences = indices.slice(1).map((index, i) => index - indices[i]);
        let std = stdv(differences)
        if (s.meta.batchDuration) {
            std *= s.meta.batchDuration
        }
        return std
    }
</script>

<div style:justify-content="center">
    <table>
        <thead>
            <tr>
                <td title="length of the juggling sequence (in seconds)">t</td>
                <td title="number of catches in the sequence">n</td>
                <td title="average time between catches (in seconds)">µ</td>
                <td title="standard devition of time between catches (in seconds)">σ</td>
                <td title="custom pattern of the name of the uploaded file"></td>
            </tr>
        </thead>
        <tbody>
            <!-- idea: add a divider or sth when the pattern changes-->
            {#each sequences as seq}
                <tr>
                    <td title={seq.time.toLocaleTimeString()}
                        >{((seq.endTime - seq.time) / 1000).toFixed(2)}s</td
                    >
                    <td>{seq.length}</td>
                    <td>{mu(seq).toFixed(2)}</td>
                    <td>{sigma(seq).toFixed(2)}</td>
                    <td>{seq.pattern}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
