#!/usr/bin/env bash
# Copy the current Cosmodex web runtime into this Tauri project's frontend dir.
# Rebuilds app.js from src/ first, then stages the four runtime files as the
# Tauri frontendDist (../src here). Entry file is renamed to index.html so Tauri
# loads it by default. Run this before `npm run tauri build`.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"

# 1. Rebuild the concatenated app.js from src/*.js
bash "$root/build.sh"

# 2. Stage the runtime files into the Tauri frontend dir
dest="$here/src"
rm -rf "$dest"
mkdir -p "$dest"
cp "$root/cosmodex-v2.html" "$dest/index.html"
cp "$root/app.js"           "$dest/app.js"
cp "$root/styles.css"       "$dest/styles.css"
cp "$root/sw.js"            "$dest/sw.js"
cp "$root/chart.html"       "$dest/chart.html"

echo "Synced Cosmodex frontend into $dest (index.html + app.js + styles.css + sw.js + chart.html)."
