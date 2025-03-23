<script lang="ts">
    let { sequences } = $props();
</script>

<div style:justify-content="center">
    <table>
        <thead>
            <tr><td>duration</td><td>throws</td><td>pattern</td></tr>
        </thead>
        <tbody>
            <!-- idea: add a divider or sth when the pattern changes-->
            {#each sequences as seq}
                <tr>
                    <td title={seq.time.toLocaleTimeString()}>{((seq.endTime - seq.time) / 1000).toFixed(2)}s</td>
                    <td>{seq.length}</td>
                    <td>{seq.pattern}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
