import { expect, test } from 'vitest';
import { countThrows } from './analyze';

const exactCases = [
    { name: '3b6c', file: 'data/3b6c.wav', expected: 6 },
    { name: '5b10c', file: 'data/5b10c.wav', expected: 10 }
];

exactCases.forEach(({ name, file, expected }) => {
    test(name, async () => {
        const t = await countThrows(file);
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

// long-running, pass timeout value or figure out how to run it faster
// test('3b100', async () => {
//     const t = await countThrows("/home/ali/Code/lab/juggle-spectrogram/christian_3b100.wav")
//     expect(t).toEqual(100)
// })

// test('5b50', async () => {
//     const t = await countThrows("/home/ali/Code/lab/juggle-spectrogram/christian_5b50.wav")
//     expect(t).toEqual(50)
// })