<script lang="ts">
const {icon, children=null} = $props()

</script>
<button>
    {#if icon}
    <span class="icon-button">
    {@render icon()}
    </span>
    {/if}
    {#if children}
    {@render children()}
    {/if}
</button>

