// ERD.md 7.2 steps 3 and 5 together: assemble, submit, and record the
// result, in the shape ERD.md 8.2 / DEMO-SCRIPT.md's right pane reads.
//
// REVISED 2026-10-27 on the manager's instruction. The first version of
// this file computed a rejection reason from live reads alone, never
// confirming it against the contract. The manager pointed out a strictly
// better option: `isValidSignatureWithSender` on the validator, called
// directly with `sender` set to the intent executor (an explicit function
// argument, not msg.sender -- no impersonation needed), bypasses the
// ACCOUNT's own `isValidSignature` wrapper, which is what swallows
// `PolicyRuleFailed` into a generic ERC-1271 failure. This file already
// used that exact technique as a diagnostic earlier in this item
// (progress/demo.md O1, the duration/spend cap tests) and confirmed it
// bubbles real revert data; this revision makes it the PRIMARY source for
// a rejection reason instead of a secondary check, for every rejection the
// validator's own policy can explain.
//
// `PolicyRuleFailed` carries no arguments and is reused for every policy
// check (owner binding, duration, spend), so the contract's revert data
// confirms THAT a rejection is real, not WHICH check caused it -- that
// attribution is still the operator's, from knowing which single input it
// deliberately pushed out of bounds. Every log entry says which kind of
// evidence backed it (`reasonSource`, operator/log.ts) so this distinction
// is never hidden from whoever reads the pane.
//
// "Funding source empty" has no validator check to confirm against: the
// renew rule verifies the batch's SHAPE (exact amounts, right addresses),
// not whether the transferFrom would actually succeed given current
// balance. That rejection is sourced from the live ERC-20 reads instead,
// labelled `reasonSource: "live-read"` -- still a call result, never
// frontend state, just not a revert.

import { createPublicClient, http, parseAbi } from "viem";
import type { Address, Hex } from "viem";
import {
  buildRenewSessionProof,
  renewGasRefund,
  renewExecutions,
  encodeExecutions,
  encodeExecutorOpsData,
  operationHash,
  singleChainDigest,
  renewEnvelope,
  accountSignature,
  signRhinestoneMessage,
  type RenewSessionInputs,
  type RenewSessionPayload,
} from "./session.ts";
import { submitMockRenewal, submitRealRenewal, type SubmitRenewalArgs } from "./submit.ts";
import { appendAttempt, type AttemptSource } from "./log.ts";
import { buildDiagnosticReadArgs, decodeRevertSelector } from "./diagnostic.ts";

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
]);
// IPermissionedRegistry.State (src/registry/interfaces/IPermissionedRegistry.sol:30-36)
// has five fields, not two; the first attempt at this ABI only declared
// `(uint8, address)` and decoded `expiry`'s bytes as part of `latestOwner`,
// which did not revert -- it silently returned a garbage address. Caught
// by comparing against a `cast call` of the SAME labelHash that returned
// the real owner, not assumed correct because it type-checked.
const REGISTRY_ABI = parseAbi([
  "function getState(uint256) view returns (uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource)",
]);
export interface AttemptRenewalArgs {
  rpcUrl: string;
  source: AttemptSource;
  transport: "mock" | "real";
  inputs: RenewSessionInputs;
  keys: { owner: Hex; session: Hex };
  senderPrivateKey: Hex;
  /** Which duration the signed session policy actually authorizes. */
  signedDuration: bigint;
  /** The requested batch's duration. Equal to signedDuration for a normal attempt. */
  requestedDuration: bigint;
  /** ETHRegistry, not ETHRegistrar -- a different contract. From config/networks.ts, never hardcoded by this file's caller. */
  ethRegistry: Address;
  /** The label's hash, e.g. `cast keccak "autorenewdemo"`. HCAOwnerAndSessionValidator.sol:997's own comment: "getState takes a labelhash". */
  labelHash: Hex;
}

/**
 * `buildRenewSessionPayload` signs the proof AND builds the executions
 * from the SAME `inputs.duration`, so it can never produce a batch that
 * disagrees with its own signature -- which is exactly right for a real
 * submission, and exactly wrong for testing "a session signed for X asked
 * to execute X+1", where a real session, signed once at setup (D13), is
 * fixed and the EXECUTIONS are what varies per attempt. This builds the
 * proof from `signedDuration` (what was actually authorized) and the
 * executions from `requestedDuration` (what this attempt asks for),
 * mirroring `buildRenewSessionPayload`'s own body field for field so the
 * two never drift apart on anything but the one deliberate difference.
 */
async function buildAttemptPayload(
  inputs: RenewSessionInputs,
  keys: { owner: Hex; session: Hex },
  signedDuration: bigint,
  requestedDuration: bigint,
): Promise<RenewSessionPayload> {
  const { proof, permissionId } = await buildRenewSessionProof(
    { ...inputs, duration: signedDuration },
    keys.owner,
  );
  const gasRefund = renewGasRefund(proof);
  const executions = renewExecutions({
    paymentToken: inputs.paymentToken,
    registrar: inputs.registrar,
    nameOwner: inputs.nameOwner,
    account: inputs.account,
    label: inputs.label,
    duration: requestedDuration,
    renewPrice: inputs.renewPrice,
  });
  const operationData = encodeExecutions(executions);
  const digest = singleChainDigest({
    chainId: inputs.chainId,
    intentExecutor: inputs.intentExecutor,
    account: inputs.account,
    nonce: inputs.nonce,
    operationHash: operationHash(executions),
    gasRefund,
  });
  const envelope = renewEnvelope({
    permissionId,
    proof,
    nonce: inputs.nonce,
    gasRefund,
    operationData,
    sessionSignature: await signRhinestoneMessage(keys.session, digest),
  });
  return {
    executions,
    operationData,
    executorOpsData: encodeExecutorOpsData(executions),
    permissionId,
    digest,
    envelope,
    accountSignature: accountSignature(envelope),
    proof,
    gasRefund,
  };
}

/**
 * The Node side of the shared diagnostic (operator/diagnostic.ts):
 * constructs the client and runs the read. Returns the decoded revert
 * selector when it reverts, or null when it does not (meaning the
 * contract accepted it).
 */
async function confirmViaValidator(
  rpcUrl: string,
  inputs: RenewSessionInputs,
  digest: Hex,
  envelope: Hex,
): Promise<Hex | null> {
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  try {
    await publicClient.readContract(buildDiagnosticReadArgs({
      validator: inputs.validator,
      intentExecutor: inputs.intentExecutor,
      account: inputs.account,
      digest,
      envelope,
    }));
    return null;
  } catch (err) {
    return decodeRevertSelector(err) ?? "0x";
  }
}

export async function attemptRenewal(args: AttemptRenewalArgs) {
  const publicClient = createPublicClient({ transport: http(args.rpcUrl) });

  const [balance, allowance, state] = await Promise.all([
    publicClient.readContract({
      address: args.inputs.paymentToken, abi: ERC20_ABI, functionName: "balanceOf",
      args: [args.inputs.nameOwner],
    }),
    publicClient.readContract({
      address: args.inputs.paymentToken, abi: ERC20_ABI, functionName: "allowance",
      args: [args.inputs.nameOwner, args.inputs.account],
    }),
    publicClient.readContract({
      address: args.ethRegistry,
      abi: REGISTRY_ABI,
      functionName: "getState",
      args: [BigInt(args.labelHash)],
    }),
  ]);
  const [, , latestOwner] = state;

  const ownerMatches = latestOwner.toLowerCase() === args.inputs.nameOwner.toLowerCase();
  const durationOk = args.requestedDuration === args.signedDuration;
  const spendOk = args.inputs.renewPrice <= args.inputs.maxRenewSpend;
  const fundsOk = balance >= args.inputs.renewPrice && allowance >= args.inputs.renewPrice;

  const base = {
    timestamp: new Date().toISOString(),
    source: args.source,
    kind: "renew" as const,
    name: args.inputs.label,
    durationSeconds: args.requestedDuration.toString(),
  };

  // Funding has no validator check to confirm against -- live-read sourced,
  // checked before building a payload at all, same as before.
  if (!fundsOk) {
    appendAttempt({
      ...base, result: "rejected", reason: "funding source empty",
      reasonSource: "live-read",
    });
    return { fired: false, reason: "funding source empty" as const };
  }

  // Every other rejection the validator itself can explain: the session
  // was signed for `signedDuration`; this attempt's batch asks for
  // `requestedDuration`, which may or may not match -- buildAttemptPayload
  // keeps those two separate on purpose, see its own comment. Then ask the
  // validator directly, bypassing the account's swallow wrapper.
  const payload = await buildAttemptPayload(
    args.inputs, args.keys, args.signedDuration, args.requestedDuration,
  );
  const expectRejection = !ownerMatches || !durationOk || !spendOk;

  if (expectRejection) {
    const revertSelector = await confirmViaValidator(
      args.rpcUrl, args.inputs, payload.digest, payload.envelope,
    );
    const reason = !ownerMatches
      ? "latestOwner does not match the session owner"
      : !durationOk
        ? "duration above the cap"
        : "spend above the cap";

    if (revertSelector === null) {
      // The live reads said this should fail and the contract disagreed.
      // Do not log a reason the contract did not confirm -- surface the
      // mismatch instead of asserting it anyway.
      appendAttempt({
        ...base, result: "rejected",
        reason: `expected rejection (${reason}) but the validator accepted it -- not logged as confirmed`,
        reasonSource: "live-read",
      });
      return { fired: false, reason: "pre-check disagreed with contract" as const };
    }
    appendAttempt({
      ...base, result: "rejected", reason,
      reasonSource: "contract-revert",
    });
    return { fired: false, reason, revertSelector } as const;
  }

  const submitArgs: SubmitRenewalArgs = {
    rpcUrl: args.rpcUrl, inputs: args.inputs, keys: args.keys,
    senderPrivateKey: args.senderPrivateKey,
  };
  const { hash } = args.transport === "mock"
    ? await submitMockRenewal(submitArgs)
    : await submitRealRenewal(submitArgs);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    appendAttempt({
      ...base, result: "rejected", reason: "transaction reverted unexpectedly",
      reasonSource: "tx-receipt",
      txHash: hash, blockNumber: receipt.blockNumber.toString(),
    });
    return { fired: true, hash, payload, receipt, reason: "unexpected revert" as const };
  }

  appendAttempt({
    ...base, result: "success",
    reason: "owner matches · within duration cap · within spend cap",
    reasonSource: "tx-receipt",
    txHash: hash, blockNumber: receipt.blockNumber.toString(),
    amount: args.inputs.renewPrice.toString(),
  });
  return { fired: true, hash, payload, receipt, reason: "success" as const };
}
