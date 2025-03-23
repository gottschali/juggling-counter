<script lang="ts">
    let { sequences } = $props();
</script>

<div style:justify-content="center">
    <table>
        <thead>
            <tr><td>time</td><td>n</td><td>pattern</td></tr>
        </thead>
        <tbody>
            <!-- idea: add a divider or sth when the pattern changes-->
            {#each sequences as seq}
                <tr>
                    <td>{seq.time.toLocaleTimeString()}</td>
                    <td>{seq.length}</td>
                    <td>{seq.pattern}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
