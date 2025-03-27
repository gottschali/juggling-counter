# Juggling Counter 🔴 (alpha)

Counts your juggling catches using audio only.
Either in real time by listening on your microphone or by analyzing a recording.

Don't use this for your world record; it's not accurate enough, but it's useful when you are too lazy to count yourself.

You can try it [here](https://counter.gschall.ch/)

Can
- count catches in regular juggling patterns
- computes statistics about your timing consistency
- logs your practice session

Can't yet
- distinguish catches from drops
- work in a moderately noisy environment

Cannot
- work in a noisy environment
- detect general siteswaps (e.g. `3` from  `531`)
- detect the number of objects juggled
- handle multiple catches at the same time (will count as one)


So far, we use a simple peak detection algorithm.
I'm open to suggestions for new filtering techniques or algorithms.
To keep it simple and available offline, I want to do everything in the client's browser.

Possible features
- [ ] _fill in the gaps_: if the algorithm misses a catch but detects a catch about two periods later, still count it. This does not work for siteswaps containing a `0`.
- [ ] calibration
- [ ] give an error message if the environment is too noisy
- [ ] add different algorithms
- [ ] _expert mode_: set parameters for the algorithms
- [ ] share recordings to develop more robust detections
- [ ] export the training log, e.g. as csv
- [ ] graphs: accuracy or number of catches vs time


Built with [Svelte](https://svelte.dev/) and the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).
