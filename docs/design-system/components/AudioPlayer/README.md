# AudioPlayer
The narration player: play/pause, a seekable waveform and elapsed/total time.

**Provide:** `src` (audio URL), `duration` (seconds), `title` ("Narration · v3"), optional `meta` (voice, provider) and `seed` to vary the drawn waveform.

- The waveform is decorative, generated from `seed`; it does not reflect the real signal.
- One player per project; it lives in the Narration panel.
