#!/usr/bin/env bash
# Concatenate the modular source in src/ (in numeric order) into the single
# runtime file app.js that cosmodex-v2.html loads.
#
# WHY a build step: app.js is one classic <script>, so the whole file shares
# one global scope and whole-file hoisting. Loading the parts as separate
# <script> tags would break forward references (functions used at load time but
# defined in a later file). Concatenating into one file preserves the original
# semantics exactly. Edit files in src/ — never edit app.js by hand.
set -euo pipefail
cd "$(dirname "$0")"
cat src/*.js > app.js
echo "Built app.js from $(ls src/*.js | wc -l | tr -d ' ') source files ($(wc -c < app.js | tr -d ' ') bytes)."
