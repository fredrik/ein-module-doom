#!/bin/sh
# Builds Doom to WebAssembly in a container (engine/Containerfile) and writes assets/doom.js,
# assets/doom.wasm and assets/doom-build.txt. Needs only docker with buildx; run from anywhere.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
docker buildx build --file "$root/engine/Containerfile" --output "type=local,dest=$root/assets" "$root/engine"
ls -l "$root/assets/doom.js" "$root/assets/doom.wasm"
