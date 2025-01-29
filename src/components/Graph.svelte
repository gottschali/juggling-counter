<script lang="ts">
    import { onMount } from "svelte";
    import Chart from "chart.js/auto";
    let { data, sampleRate = 44100 } = $props();
    let chartCanvas: HTMLCanvasElement;
    let chart: Chart | null = null;

    onMount(() => {
        chart = new Chart(chartCanvas, {
            type: "scatter",
            data: {
                datasets: [
                    {
                        label: "Frequency Data",
                        data: [] as { x: number; y: number }[],
                        pointRadius: 1,
                        type: "scatter",
                    },
                ],
            },
            options: {
                scales: {
                    // spread linearly from 0 to 1/2 of the sample rate. For example, for 48000 sample rate
                    x: {
                        title: {
                            display: true,
                            text: "Frequency [Hz]",
                        },
                        type: "linear",
                        min: 0,
                        max: sampleRate / 2,
                    },
                    y: {
                        title: {
                            display: true,
                            text: "decibel Hz",
                        },
                        min: 0,
                        max: 128,
                    },
                },
            },
        });
    });
    $effect(() => {
        const scatterData = Array.from(data).map((value, index) => ({
            x: ((index / 128) * sampleRate) / 2,
            y: value,
        }));
        if (chart !== null) {
            chart.data.datasets[0].data = scatterData as {
                x: number;
                y: number;
            }[];

            chart.update();
        }
    });
</script>

<canvas bind:this={chartCanvas} width="400" height="200"></canvas>
