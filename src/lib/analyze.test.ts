import { expect, test } from 'vitest';
import { countThrows, sequences } from './analyze';

const exactCases = [
    { name: '3b6c', file: 'data/3b6c.wav', expected: [6] },
    { name: '5b10c', file: 'data/5b10c.wav', expected: [10] },
    { name: 'loud3b15c', file: 'data/loud3b15c.mp3', expected: [15] },
    { name: 'loud3b15c', file: 'data/fast3b15c.mp3', expected: [15] },
    { name: 'slow3b', file: 'data/slow3b.mp3', expected: [15] },
    { name: '3b3x3', file: 'data/3b3x3.mp3', expected: [3, 3, 3] },
];

exactCases.forEach(({ name, file, expected }) => {
    test(name, async () => {
        const t = (await sequences(file)).map(s => s.length)
        expect(t).toEqual(expected);
    });
});

// Test different audio formats are correctly decoded
const formatCases = [
    'wav',
    'mp3',
    // m4a // works in the browser but not in node
    'aac',
    'flac',
    'ogg',
];

formatCases.forEach((fmt) => {
    test(fmt, async () => {
        const t = await countThrows(`data/3b6c.${fmt}`);
        expect(t).toEqual(6);
    });
});

const approximateTests = [
    // [lib/errors.js] Unexpected Rust error [Error: Panic in async function] { code: 'GenericFailure' }
    // { name: '3b100', file: 'data/christian_3b100.mp3', expected: 100, delta: 7},
    { name: '5b50', file: 'data/christian_5b50.mp3', expected: 50, delta: 5},
];

approximateTests.forEach(({ name, file, expected, delta }) => {
    test(name, async () => {
        const t = await countThrows(file);
        expect(t).closeTo(expected, delta)
    });
});
