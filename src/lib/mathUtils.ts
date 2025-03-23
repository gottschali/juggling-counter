export function average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function stdv(values: number[], mu: number | null = null): number {
    if (mu === null) {
        mu = average(values)
    }
    const variance = average(values.map(x => (x - mu) ** 2))
    return Math.sqrt(variance);
}