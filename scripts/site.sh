#!/usr/bin/env bash
#
# Build or serve the documentation site with the Deno version the site needs.
#
# The site cannot be built with whatever Deno happens to be installed. Lume
# pulls in deno-dom 0.1.56, which imports a type as a value; Deno stopped
# erasing that in 2.9, so the build dies on a module that does not export what
# it is asked for. `.deno-version-docs` pins the last version that works, and
# CI builds the site with it too.
#
# Usage:
#   bash scripts/site.sh serve    # http://localhost:3000/
#   bash scripts/site.sh build    # writes _site/
#
# Serving and building do not produce the same URLs. A build targets GitHub
# Pages, where the site lives under /spandex/, so links carry that prefix. Lume
# overrides that when serving, and the dev server answers at the root.
#
# The pinned toolchain downloads into .ci-deno/ (gitignored) and is reused. If
# your own Deno already matches the pin, that one is used and nothing is
# downloaded.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMMAND="${1:-serve}"
case "$COMMAND" in
build | serve) ;;
*)
	echo "usage: bash scripts/site.sh [build|serve]" >&2
	exit 2
	;;
esac

VERSION="$(tr -d '[:space:]' < .deno-version-docs)"

# Use the ambient Deno when it already matches, so the common case needs no
# download and no cache.
if command -v deno > /dev/null && [ "$(deno --version | head -1 | cut -d' ' -f2)" = "$VERSION" ]; then
	BIN="$(command -v deno)"
else
	case "$(uname -m)" in
	aarch64 | arm64) TARGET=aarch64-unknown-linux-gnu ;;
	*) TARGET=x86_64-unknown-linux-gnu ;;
	esac
	case "$(uname -s)" in
	Darwin) TARGET="${TARGET%%-*}-apple-darwin" ;;
	esac

	DIR="$ROOT/.ci-deno/v$VERSION"
	BIN="$DIR/deno"
	if [ ! -x "$BIN" ]; then
		echo "The site needs Deno $VERSION; fetching it into .ci-deno/ ..." >&2
		mkdir -p "$DIR"
		curl -fsSL "https://dl.deno.land/release/v$VERSION/deno-$TARGET.zip" -o "$DIR/deno.zip"
		unzip -oq "$DIR/deno.zip" -d "$DIR"
		chmod +x "$BIN"
	fi
fi

if [ "$COMMAND" = "serve" ]; then
	echo "Serving on http://localhost:3000/ (Ctrl-C to stop)" >&2
fi

cd "$ROOT/site"
PATH="$(dirname "$BIN"):$PATH" exec "$BIN" task "$COMMAND"
