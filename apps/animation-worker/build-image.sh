#!/bin/sh
# Builds the pinned sequence worker image from trusted sources only.
set -eu
cd "$(dirname "$0")"
VERSION=$(node -e "console.log(require('fs').readFileSync('src/job.ts','utf8').match(/WORKER_VERSION = \"([^\"]+)\"/)[1])")
docker build --build-context motion=../renderer/src/motion -t "vcp-animation-worker:${VERSION}" "$@" .
