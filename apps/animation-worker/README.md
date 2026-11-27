# Sequence worker

A disposable container that compiles and renders one authored animation sequence (Remotion TSX) per run. The trusted host launcher is `packages/providers/render-remotion/src/sequence-worker.ts`. The design is in [the M2.5 plan](../../docs/m2.5-animation-quality-plan.md#run-authored-tsx-as-project-content).

## Build

```bash
pnpm animation-worker:build
```

This builds `vcp-animation-worker:<WORKER_VERSION>` (see `src/job.ts`) from the pinned `image/package-lock.json`. Chromium's headless shell is downloaded at build time. The motion toolkit (`apps/renderer/src/motion`) is added as a named build context. Rebuild after changing the toolkit, the wrapper, the preflight or the worker. Bump `WORKER_VERSION` when output can change.

## What a run does

The host pipes one JSON job to stdin (`src/job.ts`): the source, the sequence props (fps, frame count, seed, local cue frames, beat intervals with caption boxes, style and poses), the profile and the mode. Inside the container the worker runs these steps:

1. Preflight (`src/preflight.ts`) checks size, syntax, imports (`react` and `@vcp/motion` only), the single default export, globals, unseeded randomness and time, frame-to-frame React state, raw HTML, forbidden elements, `#id`-only URL attributes and external URLs in literals.
2. It typechecks the module against `SequenceProps`.
3. It bundles the module with the trusted wrapper (`wrapper/entry.tsx`).
4. It renders: `draft` is 540×960 H.264 via `scale: 0.5` of the 1080×1920 design space, and `full` is 1080×1920 ProRes HQ. Both are muted, so no audio stream. `stills` mode renders PNGs of the listed frames in the given order in one tab.
5. It writes framed files to stdout (`src/protocol.ts`). Diagnostics go to stderr as `VCPDIAG`/`VCPPROGRESS` JSON lines.

## Isolation

`dockerRunArgs` sets `--network none`, a read-only image, `--cap-drop ALL`, `no-new-privileges`, an unprivileged user, PID/memory/CPU limits, and noexec tmpfs mounts for `/tmp` (output) and `/app/job` (scratch). There are no bind mounts, environment variables or credentials. The docker CLI itself gets only `PATH`, `HOME` and `DOCKER_*`. The host caps stdout bytes, accepts only expected file names, kills the container on timeout or abort (`ANIMATION_WORKER_TIMEOUT_MS`, default 10 min) and probes every video before storing it.

## Tests

- `pnpm --filter @vcp/animation-worker test`: preflight and framing.
- `ANIMATION_WORKER=1 pnpm --filter @vcp/provider-render-remotion exec vitest run test/sequence-worker.docker.test.ts`: real container runs. These cover both profiles with exact frame counts and cache reuse, shuffled-order seek determinism, in-container preflight rejection, network isolation against a host canary (with a positive control), and timeout kill. Set `ANIMATION_WORKER_OUT=<dir>` to keep outputs. Bundling dominates the run time. With a host load average above 130, it took about 27 minutes per job during development, with or without networking. The idle-machine time has not been measured.
- Render the fixture by hand: `pnpm --filter @vcp/provider-render-remotion exec tsx scripts/sequence-fixture.ts <outDir> draft|full|stills [frames…]`.
- Render the full FactShort with a sequence: `pnpm --filter @vcp/provider-render-remotion exec tsx scripts/sequence-factshort.ts <blobDir> <narration.wav>`.
