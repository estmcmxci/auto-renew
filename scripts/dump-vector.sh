#!/usr/bin/env bash
# Regenerates the C4 golden vector from the Solidity side.
#
# `operator/session.ts` rebuilds the HCA renew payload off chain, and
# `operator/session.vector.test.ts` asserts it matches the Solidity
# construction byte for byte. This script produces the file that test reads.
#
# Run it whenever `AutoRenewSessionFixture.sol`, `AutoRenewPolicy.t.sol` or
# the validator's packing changes. The inputs and the outputs are written
# together, so a regenerated vector stays self-consistent: `validUntil` is
# `block.timestamp + 1 days` on the fork, which moves every run, and it feeds
# the salt, so a vector whose inputs and outputs came from different runs
# would never match.
#
# progress/contracts.md C4.
set -euo pipefail

ROOT="/Users/oakgroup/auto-renew"
OUT="$ROOT/operator/vectors/renew-t1.json"

cd "$ROOT"
# A real temp file, not process substitution. Sourcing `<(bun ...)` under
# `set -a` left the AR_* variables unset here, and an unset address makes
# `setUp` fail with no vector line, which looks identical to a broken test.
ENVFILE="$(mktemp)"
trap 'rm -f "$ENVFILE"' EXIT
bun config/export-env.ts 11155111 > "$ENVFILE"
set -a
# shellcheck disable=SC1090
. "$ENVFILE"
. ./.env
set +a

cd "$ROOT/contracts-v2/contracts"
# forge sends its log lines to stderr when stdout is not a terminal, so
# both streams are merged before the grep.
LINE="$(forge test --match-test test_emit_typescriptVector -vv 2>&1 |
  grep -o '{"chainId".*}' | tail -1)"

if [ -z "$LINE" ]; then
  echo "no vector line in the forge output; the case did not run" >&2
  exit 1
fi

printf '%s\n' "$LINE" | python3 -m json.tool > "$OUT"
echo "wrote $OUT"
