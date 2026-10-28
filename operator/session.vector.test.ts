// Byte-equality check for the TypeScript port of the HCA session payload.
//
// progress/contracts.md C4. `operator/session.ts` rebuilds a construction
// that already exists in Solidity. Two implementations of one byte layout
// drift. This file is the only thing that stops them.
//
// The vector in `operator/vectors/renew-t1.json` comes from
// `test_emit_typescriptVector` in
// `contracts-v2/contracts/test/unit/hca/AutoRenewPolicy.t.sol`, which runs the
// SAME `_prepareBatch` as T1 and asserts the account accepts the payload
// before printing it. So a match here is not merely "the two encoders agree";
// it is "this TypeScript produced a payload the deployed policy accepted".
//
// Regenerate with `scripts/dump-vector.sh` after any change to the fixture,
// the test helpers or the validator's packing.
//
// Run:  cd /Users/oakgroup/auto-renew && bun test operator/session.vector.test.ts

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Address, Hex } from "viem";

import {
  ACCOUNT_SIGNATURE_PREFIX,
  SESSION_PROOF_HEADER_LENGTH,
  accountSignature,
  buildRenewSessionPayload,
  encodeExecutions,
  encodeExecutorOpsData,
  packProof,
  renewExecutions,
  type RenewSessionInputs,
} from "./session.ts";

interface Vector {
  chainId: number;
  account: Address;
  validator: Address;
  intentExecutor: Address;
  registrar: Address;
  paymentToken: Address;
  nameOwner: Address;
  sessionKey: Address;
  ownerPrivateKey: Hex;
  sessionPrivateKey: Hex;
  label: string;
  duration: number;
  renewPrice: number;
  maxRenewSpend: number;
  validUntil: number;
  sessionNonce: number;
  nonce: number;
  sessionToEnableIndex: number;
  refundToken: Address;
  maxRefundExchangeRate: number;
  maxRefundGasOverhead: number;
  maxRefundAmount: number;
  sourceChainId: number;
  sourceSessionDigest: Hex;
  expectedPermissionId: Hex;
  expectedDigest: Hex;
  expectedOperationData: Hex;
  expectedEnvelope: Hex;
}

const vector: Vector = JSON.parse(
  readFileSync(new URL("./vectors/renew-t1.json", import.meta.url), "utf8"),
);

/**
 * The vector's own fields, mapped to `RenewSessionInputs`. Nothing is
 * invented here: every value is read from the file, so the TypeScript side
 * gets the identical inputs the Solidity side had and the only variable left
 * is the construction itself.
 */
const inputs: RenewSessionInputs = {
  chainId: BigInt(vector.chainId),
  account: vector.account,
  validator: vector.validator,
  intentExecutor: vector.intentExecutor,
  registrar: vector.registrar,
  paymentToken: vector.paymentToken,
  nameOwner: vector.nameOwner,
  sessionKey: vector.sessionKey,
  label: vector.label,
  duration: BigInt(vector.duration),
  renewPrice: BigInt(vector.renewPrice),
  maxRenewSpend: BigInt(vector.maxRenewSpend),
  validUntil: BigInt(vector.validUntil),
  sessionNonce: BigInt(vector.sessionNonce),
  nonce: BigInt(vector.nonce),
  sessionToEnableIndex: vector.sessionToEnableIndex,
  refund: {
    token: vector.refundToken,
    maxExchangeRate: BigInt(vector.maxRefundExchangeRate),
    maxGasOverhead: BigInt(vector.maxRefundGasOverhead),
    maxAmount: BigInt(vector.maxRefundAmount),
  },
  sourceChain: {
    chainId: BigInt(vector.sourceChainId),
    sessionDigest: vector.sourceSessionDigest,
  },
};

const keys = { owner: vector.ownerPrivateKey, session: vector.sessionPrivateKey };

describe("operator/session.ts matches the Solidity construction", () => {
  // The four assertions below are deliberately separate. A single envelope
  // comparison tells you only that something is wrong; these tell you WHICH
  // layer moved, which is what a 150-byte packed header needs.

  test("operationData: the packed executions match", async () => {
    const executions = renewExecutions({
      paymentToken: inputs.paymentToken,
      registrar: inputs.registrar,
      nameOwner: inputs.nameOwner,
      account: inputs.account,
      label: inputs.label,
      duration: inputs.duration,
      renewPrice: inputs.renewPrice,
    });
    expect(encodeExecutions(executions)).toBe(vector.expectedOperationData);
  });

  test("permissionId: the ten-field salt matches", async () => {
    // The salt is where R3's third pass went wrong in Solidity: the three
    // renew fields must be in it. If they are missing here the permissionId
    // diverges and the validator answers InvalidSessionData.
    const payload = await buildRenewSessionPayload(inputs, keys);
    expect(payload.permissionId).toBe(vector.expectedPermissionId);
  });

  test("digest: the IntentExecutor single-chain hash matches", async () => {
    const payload = await buildRenewSessionPayload(inputs, keys);
    expect(payload.digest).toBe(vector.expectedDigest);
  });

  test("envelope: byte equality with the fixture", async () => {
    const payload = await buildRenewSessionPayload(inputs, keys);
    expect(payload.envelope).toBe(vector.expectedEnvelope);
  });

  test("envelope: the BARE form is unchanged by the account prefix", async () => {
    // C7 gap 1 added the prefixed form. This asserts the bare one did not
    // move, because the vector above is the only thing tying this port to the
    // Solidity fixture and a silent change there would cost the whole proof.
    const payload = await buildRenewSessionPayload(inputs, keys);
    expect(payload.envelope).toBe(vector.expectedEnvelope);
    expect(payload.envelope.slice(0, 4)).toBe("0x05");
  });

  test("accountSignature: 20 zero bytes, then the same envelope", async () => {
    // What the deployed account requires. `isValidSignature` reads
    // `signature[:20]` and reverts ValidatorNotInstalled unless it is zero,
    // then forwards `signature[20:]`.
    const payload = await buildRenewSessionPayload(inputs, keys);
    expect(ACCOUNT_SIGNATURE_PREFIX).toBe(`0x${"00".repeat(20)}`);
    expect(payload.accountSignature).toBe(accountSignature(payload.envelope));
    // Byte equality the other way round: strip the prefix, get the vector back.
    expect(`0x${payload.accountSignature.slice(42)}`).toBe(vector.expectedEnvelope);
    expect((payload.accountSignature.length - 2) / 2).toBe(
      (vector.expectedEnvelope.length - 2) / 2 + 20,
    );
  });

  test("executorOpsData: same executions, the executor's ABI encoding", async () => {
    // NOT asserted against a Solidity vector. The executor's libraries are
    // not vendored in this clone, so there is no local build to compare to.
    // See progress/contracts.md C7: the authority for this encoding is the
    // eth_call simulation, not this assertion. What IS checked here is that
    // the two encodings carry the same mode bytes and decode to the same
    // executions, and that they are genuinely DIFFERENT bytes, so nobody
    // later "simplifies" one into the other.
    const payload = await buildRenewSessionPayload(inputs, keys);
    const executions = renewExecutions({
      paymentToken: inputs.paymentToken,
      registrar: inputs.registrar,
      nameOwner: inputs.nameOwner,
      account: inputs.account,
      label: inputs.label,
      duration: inputs.duration,
      renewPrice: inputs.renewPrice,
    });
    expect(payload.executorOpsData).toBe(encodeExecutorOpsData(executions));
    // Byte 0 = exec type 2 (ERC7579), byte 1 = sig mode 1 (ERC1271).
    expect(payload.executorOpsData.slice(0, 6)).toBe("0x0201");
    expect(payload.operationData.slice(0, 6)).toBe("0x0201");
    expect(payload.executorOpsData).not.toBe(payload.operationData);
  });

  test("settlement none: the actual refund is zero, the proof maxima are not", async () => {
    // The no-refund shape C6 recommends. The proof must still carry non-zero
    // maxima or the validator refuses it outright.
    const payload = await buildRenewSessionPayload(
      { ...inputs, settlement: "none" },
      keys,
    );
    expect(payload.gasRefund.token).toBe("0x0000000000000000000000000000000000000000");
    expect(payload.gasRefund.exchangeRate).toBe(0n);
    expect(payload.gasRefund.overhead).toBe(0n);
    expect(payload.proof.refundToken).not.toBe(
      "0x0000000000000000000000000000000000000000",
    );
    expect(payload.proof.maxRefundExchangeRate).toBeGreaterThan(0n);
    expect(payload.proof.maxRefundAmount).toBeGreaterThan(0n);
    // A different digest from the refund route, so the two cannot be confused.
    expect(payload.digest).not.toBe(vector.expectedDigest);
  });

  test("the packed proof header is 150 bytes", async () => {
    // The number the validator's `_SESSION_PROOF_HEADER_LENGTH` must agree
    // with. R3 moved it from 110 to 150 and broke sixteen tests; this pins
    // the TypeScript side to the same number.
    const payload = await buildRenewSessionPayload(inputs, keys);
    const headerAndEntries = packProof(payload.proof);
    const entryBytes = payload.proof.hashesAndChainIds.length * 40;
    const ownerSignatureBytes = 65;
    expect((headerAndEntries.length - 2) / 2 - entryBytes - ownerSignatureBytes).toBe(
      SESSION_PROOF_HEADER_LENGTH,
    );
  });
});
