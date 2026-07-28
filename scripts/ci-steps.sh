#!/usr/bin/env bash
#
# The verification sequence, in order.
#
# This file is the only definition of it. CI runs this script and so does
# `deno task ci`, so the two cannot drift: previously the workflow listed the
# steps itself under a comment asking the next editor to keep them in sync by
# hand, which is a convention rather than a guarantee.
#
# Usage: bash scripts/ci-steps.sh
set -euo pipefail

step() {
	echo ""
	echo "=== $* ==="
	"$@"
}

step deno task fmt --check
step deno task lint
step deno task check
step deno task meta-check
step deno task test

echo ""
echo "All checks passed."
