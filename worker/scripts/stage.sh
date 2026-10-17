#!/usr/bin/env bash
# Copy only what the worker image needs into a fresh build context and print
# its path. Keeps .env files, node_modules and the web app out of the build.
#   ctx=$(worker/scripts/stage.sh)
#   npx -y @insforge/cli compute deploy "$ctx" --name jobpilot-worker ...
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
ctx="$(mktemp -d "${TMPDIR:-/tmp}/jobpilot-worker.XXXXXX")"
mkdir -p "$ctx/worker" "$ctx/lib"
cp "$root/worker/Dockerfile" "$ctx/Dockerfile"
cp "$root/worker/package.json" "$root/worker/package-lock.json" "$ctx/worker/"
cp -R "$root/worker/src" "$ctx/worker/src"
cp -R "$root/lib/ats" "$ctx/lib/ats"
cp "$root/lib/applications.ts" "$root/lib/utils.ts" "$ctx/lib/"
echo "$ctx"
