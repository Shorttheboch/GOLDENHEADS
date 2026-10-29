#!/bin/bash
# Run one automatic test against a build folder, served on http://127.0.0.1:8765 only while the test runs.
#   tools/run-test.sh dist-test tools/tests/pc-game.cjs
#   tools/run-test.sh dist      tools/tests/pc-menu-real.cjs
# Needs Playwright with Chromium (tests run with the software GPU, so they are slow but work anywhere).
# Screenshots go to tools/tests/out/ (not in git). PORT=8766 tools/run-test.sh … uses another port.
DIR=$1; shift
PORT=${PORT:-8765}; export HEADS_URL=http://127.0.0.1:$PORT
cd "$(dirname "$0")/.."
python3 -m http.server $PORT --bind 127.0.0.1 --directory "$DIR" >/dev/null 2>&1 &
SRV=$!
for i in $(seq 1 30); do curl -s -o /dev/null $HEADS_URL/index.html && break; sleep 0.5; done
mkdir -p tools/tests/out
timeout 900 node "$@"; RC=$?
kill $SRV; exit $RC
