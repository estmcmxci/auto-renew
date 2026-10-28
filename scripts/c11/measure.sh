#!/bin/bash
# C11 size measurement harness.
# Usage: measure.sh <label> <validator.sol> <lib.sol>
# Builds at ENS actual settings (optimizer_runs=23000) and prints the
# HCAOwnerAndSessionValidator runtime size in bytes.
# NOTE: `forge build --sizes` exits 1 because the PRE-EXISTING WrapperRegistry
# exceeds EIP-170 in this tree. That is unrelated to the validator, so the
# exit code is ignored and success is judged on the size row being present.
set -uo pipefail
C=/Users/oakgroup/auto-renew/contracts-v2/contracts
LABEL="$1"; VAL="$2"; LIB="$3"
cp "$VAL" "$C/src/hca/HCAOwnerAndSessionValidator.sol"
cp "$LIB" "$C/src/hca/libraries/HCARegistrarPolicyLib.sol"
cd "$C"
FOUNDRY_OPTIMIZER_RUNS=23000 forge build --skip test --sizes > /tmp/c11_build_"$LABEL".log 2>&1
SIZE=$(grep -E "^\|[[:space:]]*HCAOwnerAndSessionValidator[[:space:]]*\|" /tmp/c11_build_"$LABEL".log \
  | awk -F'|' '{gsub(/[ ,]/,"",$3); print $3}')
if [ -z "$SIZE" ]; then
  echo "$LABEL BUILD_FAILED"
  grep -E "^Error|error\[|Compiler run failed" -A6 /tmp/c11_build_"$LABEL".log | head -40
  exit 1
fi
echo "$LABEL $SIZE"
