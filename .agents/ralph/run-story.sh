#!/bin/bash
# Run Ralph for a story (iterates until all gates clear or max reached)
# Usage: ./run-story.sh [max_iterations]
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX=${1:-10}
"$SCRIPT_DIR/loop.sh" build "$MAX"
