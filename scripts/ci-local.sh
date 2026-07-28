#!/usr/bin/env bash
#
# Run the CI verification sequence locally against specific Deno versions.
#
# The failures this exists to catch are toolchain drift, not code drift: CI once
# ran a floating `canary`, so an upstream pre-release could break the build with
# no change to this repository, and no local run could reproduce it because
# local Deno was whatever happened to be installed.
#
# Usage:
#   bash scripts/ci-local.sh                # the pinned version in .deno-version
#   bash scripts/ci-local.sh pinned canary  # both, reporting each
#   bash scripts/ci-local.sh v2.8.0         # any explicit version
#
# Downloaded toolchains land in .ci-deno/ (gitignored) and are reused.
#
# This runs the same steps as CI, not the same environment. It cannot catch a
# failure that depends on the runner image, on the workspace-local DENO_DIR that
# setup-deno configures, or on a cold module cache. For those, read the workflow.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PINNED="$(tr -d '[:space:]' < .deno-version)"
CACHE="$ROOT/.ci-deno"
mkdir -p "$CACHE"

case "$(uname -m)" in
aarch64 | arm64) TARGET=aarch64-unknown-linux-gnu ;;
*) TARGET=x86_64-unknown-linux-gnu ;;
esac

# Print the path to a deno binary for the given label, downloading if needed.
resolve_deno() {
	local label="$1" version url dir
	case "$label" in
	pinned) version="v$PINNED" ;;
	canary) version="canary" ;;
	*) version="$label" ;;
	esac

	if [ "$version" = "canary" ]; then
		local sha
		sha="$(curl -fsSL https://dl.deno.land/canary-latest.txt | tr -d '[:space:]')" || return 1
		dir="$CACHE/canary-${sha:0:12}"
		url="https://dl.deno.land/canary/$sha/deno-$TARGET.zip"
	else
		dir="$CACHE/$version"
		url="https://dl.deno.land/release/$version/deno-$TARGET.zip"
	fi

	if [ ! -x "$dir/deno" ]; then
		mkdir -p "$dir"
		curl -fsSL "$url" -o "$dir/deno.zip" || return 1
		unzip -oq "$dir/deno.zip" -d "$dir" || return 1
		chmod +x "$dir/deno"
	fi
	printf '%s\n' "$dir/deno"
}

LABELS=("$@")
[ ${#LABELS[@]} -eq 0 ] && LABELS=(pinned)

declare -a RESULTS=()
FAILED=0

for label in "${LABELS[@]}"; do
	echo ""
	echo "############################################################"
	echo "# $label"
	echo "############################################################"

	if ! bin="$(resolve_deno "$label")"; then
		echo "could not obtain a deno for '$label'"
		RESULTS+=("$label: UNAVAILABLE")
		FAILED=1
		continue
	fi

	echo "using $("$bin" --version | head -1)"
	# Give each toolchain its own module cache so one version's cache cannot
	# mask another's resolution failure.
	if DENO_DIR="$CACHE/denodir-$label" PATH="$(dirname "$bin"):$PATH" bash scripts/ci-steps.sh; then
		RESULTS+=("$label: PASS")
	else
		RESULTS+=("$label: FAIL")
		FAILED=1
	fi
done

echo ""
echo "############################################################"
for line in "${RESULTS[@]}"; do echo "# $line"; done
echo "############################################################"
exit "$FAILED"
