// ERD.md 7.2 step 4: "On a funding failure, write the fallback address."
// ERD.md section 5: no contract change needed -- `setAddress` is already
// in the validator's record-selector allowlist. Two preconditions the ERD
// did not name, found and measured live by contracts C8/E9: the session's
// proof must NAME the resolver (a resolver=0 proof, which every renew
// proof in this project uses, is refused for a setAddress execution), and
// that resolver must be a VerifiableFactory proxy of PERMITTED_RESOLVER_IMPL
// with the HCA account granted ROLE_SET_ADDRESS on it
// (`grantSetterRoles`, not plain `grantRoles` -- E9's own correction to
// C8). On `autorenewdemo` both preconditions are now satisfied
// (progress/evidence.md E9); this file is the reusable construction, the
// proven shape from `operator/c8-probe.ts`'s case B
// (`0x1626ba7e` accepted), generalized to write a real value instead of
// the probe's harmless self-address.
//
// Boundary, same discipline as session.ts/submit.ts: this file builds the
// session.ts-shaped payload for a setAddress batch, reusing session.ts's
// lower-level exports (nothing here duplicates C4/C7's renew-proof
// construction; it is the SAME salt/digest/signature machinery, applied
// to a different proof.resolver and a different execution). It does not
// touch session.ts itself -- everything needed was already exported for
// the renew case.

import { createWalletClient, encodeFunctionData, http, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { REAL_EXECUTOR_ABI } from "./submit.ts";
import {
  buildRenewSessionProof,
  sessionSalt,
  permissionId as computePermissionId,
  destinationSessionDigest,
  ownerAuthorizationDigest,
  signOwnerAuthorization,
  encodeExecutions,
  encodeExecutorOpsData,
  operationHash,
  singleChainDigest,
  renewEnvelope,
  accountSignature,
  signRhinestoneMessage,
  NO_GAS_REFUND,
  type RenewSessionInputs,
  type Execution,
  type RenewSessionPayload,
} from "./session.ts";

const SET_ADDRESS_ABI = [
  {
    type: "function", name: "setAddress", stateMutability: "nonpayable",
    inputs: [{ type: "bytes" }, { type: "uint256" }, { type: "bytes" }], outputs: [],
  },
] as const;

/** ENSIP-10 DNS encoding of a dotted name, e.g. "autorenewdemo.eth". */
function dnsEncode(name: string): Hex {
  const parts = name.split(".").flatMap((label) => {
    const bytes = new TextEncoder().encode(label);
    return [bytes.length, ...bytes];
  });
  return ("0x" + [...parts, 0].map((n) => n.toString(16).padStart(2, "0")).join("")) as Hex;
}

export function setAddressExecution(args: {
  resolver: Address;
  label: string;
  coinType: bigint;
  value: Address;
}): Execution {
  return {
    target: args.resolver,
    value: 0n,
    callData: encodeFunctionData({
      abi: SET_ADDRESS_ABI,
      functionName: "setAddress",
      args: [dnsEncode(`${args.label}.eth`), args.coinType, args.value],
    }),
  };
}

export interface FallbackSessionInputs {
  chainId: bigint;
  account: Address;
  validator: Address;
  intentExecutor: Address;
  /** Must be a VerifiableFactory proxy of PERMITTED_RESOLVER_IMPL, and the
   * account must already hold ROLE_SET_ADDRESS on it (progress/evidence.md E9). */
  resolver: Address;
  nameOwner: Address;
  sessionKey: Address;
  label: string;
  coinType: bigint;
  /** The address to write into the record -- FALLBACK_ADDRESS for real use. */
  fallbackAddress: Address;
  validUntil: bigint;
  sessionNonce: bigint;
  nonce: bigint;
}

/**
 * Builds a session-signed payload for one setAddress execution, naming
 * `inputs.resolver` in the proof. Mirrors operator/c8-probe.ts's proven
 * case B exactly: start from the renew proof builder (same ten-field
 * salt, same owner-authorization shape), override `resolver`, then
 * recompute everything downstream of it (salt depends on resolver, so
 * permissionId and the owner's cross-chain authorization do too) rather
 * than patching only `proof.resolver` and leaving a stale signature.
 */
export async function buildFallbackPayload(
  inputs: FallbackSessionInputs,
  keys: { owner: Hex; session: Hex },
): Promise<RenewSessionPayload> {
  // renew-shaped fields below are placeholders the proof format requires
  // but this batch never uses (no renew execution in it); duration/price
  // of 1 cannot be mistaken for a real renewal policy.
  const renewLikeInputs: RenewSessionInputs = {
    chainId: inputs.chainId, account: inputs.account, validator: inputs.validator,
    intentExecutor: inputs.intentExecutor, registrar: inputs.account, // unused placeholder
    paymentToken: inputs.resolver, // unused placeholder
    nameOwner: inputs.nameOwner, sessionKey: inputs.sessionKey, label: inputs.label,
    duration: 1n, renewPrice: 1n, maxRenewSpend: 1n,
    validUntil: inputs.validUntil, sessionNonce: inputs.sessionNonce, nonce: inputs.nonce,
    sessionToEnableIndex: 1, settlement: "none",
    refund: {
      token: inputs.resolver, maxExchangeRate: 5_000_000_000n, maxGasOverhead: 100_000n,
      maxAmount: 25_000_000n,
    },
    sourceChain: { chainId: 84532n, sessionDigest: keccak256(toHex("source session")) },
  };

  const { proof, permissionId: initialId } = await buildRenewSessionProof(
    renewLikeInputs, keys.owner,
  );
  proof.resolver = inputs.resolver;
  const salt = sessionSalt(proof);
  const id = computePermissionId(inputs.sessionKey, salt);
  proof.hashesAndChainIds = [
    renewLikeInputs.sourceChain,
    {
      chainId: inputs.chainId,
      sessionDigest: destinationSessionDigest({ account: inputs.account, sessionKey: inputs.sessionKey, salt }),
    },
  ];
  const ownerSig = await signOwnerAuthorization(
    keys.owner, ownerAuthorizationDigest(proof.hashesAndChainIds),
  );
  proof.ownerR = ownerSig.r;
  proof.ownerS = ownerSig.s;
  proof.ownerV = ownerSig.v;
  void initialId; // superseded by `id`, recomputed after the resolver override.

  const executions = [setAddressExecution({
    resolver: inputs.resolver, label: inputs.label, coinType: inputs.coinType,
    value: inputs.fallbackAddress,
  })];
  const operationData = encodeExecutions(executions);
  const digest = singleChainDigest({
    chainId: inputs.chainId, intentExecutor: inputs.intentExecutor, account: inputs.account,
    nonce: inputs.nonce, operationHash: operationHash(executions), gasRefund: NO_GAS_REFUND,
  });
  const envelope = renewEnvelope({
    permissionId: id, proof, nonce: inputs.nonce, gasRefund: NO_GAS_REFUND,
    operationData, sessionSignature: await signRhinestoneMessage(keys.session, digest),
  });

  return {
    executions, operationData,
    executorOpsData: encodeExecutorOpsData(executions),
    permissionId: id, digest, envelope,
    accountSignature: accountSignature(envelope),
    proof, gasRefund: NO_GAS_REFUND,
  };
}

/**
 * Submits the fallback write through the real IntentExecutor's no-refund
 * entry point, same transport submit.ts's submitRealRenewal uses --
 * `executeSinglechainOps` is generic over the batch, it does not care
 * whether the batch is a renewal or a single setAddress call.
 */
export async function submitFallback(args: {
  rpcUrl: string;
  inputs: FallbackSessionInputs;
  keys: { owner: Hex; session: Hex };
  senderPrivateKey: Hex;
}) {
  const payload = await buildFallbackPayload(args.inputs, args.keys);
  const sender = privateKeyToAccount(args.senderPrivateKey);
  const client = createWalletClient({ account: sender, transport: http(args.rpcUrl) });

  const hash = await client.writeContract({
    address: args.inputs.intentExecutor,
    abi: REAL_EXECUTOR_ABI,
    functionName: "executeSinglechainOps",
    chain: null,
    args: [{
      account: args.inputs.account,
      nonce: args.inputs.nonce,
      ops: { data: payload.executorOpsData },
      signature: payload.accountSignature,
    }],
  });

  return { hash, payload };
}

/**
 * ERD.md 7.2 step 5 for the fallback leg: record the attempt, same log
 * attempt.ts writes to, same discipline (every field a call result). The
 * caller decides WHEN to call this -- after attemptRenewal (operator/
 * attempt.ts) returns "funding source empty", per DEMO-SCRIPT.md beat 5 --
 * this file only builds, sends, and records one fallback write.
 */
export async function attemptFallback(args: {
  rpcUrl: string;
  source: import("./log.ts").AttemptSource;
  inputs: FallbackSessionInputs;
  keys: { owner: Hex; session: Hex };
  senderPrivateKey: Hex;
}) {
  const { appendAttempt } = await import("./log.ts");
  const { createPublicClient, http: httpTransport } = await import("viem");
  const publicClient = createPublicClient({ transport: httpTransport(args.rpcUrl) });

  const { hash } = await submitFallback(args);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const base = {
    timestamp: new Date().toISOString(),
    source: args.source,
    kind: "setAddress" as const,
    name: args.inputs.label,
  };

  if (receipt.status !== "success") {
    appendAttempt({
      ...base, result: "rejected", reason: "transaction reverted unexpectedly",
      reasonSource: "tx-receipt", txHash: hash, blockNumber: receipt.blockNumber.toString(),
    });
    return { fired: true, hash, receipt, reason: "unexpected revert" as const };
  }

  appendAttempt({
    ...base, result: "success",
    reason: "permitted by the existing policy · no change requested",
    reasonSource: "tx-receipt",
    txHash: hash, blockNumber: receipt.blockNumber.toString(),
    address: args.inputs.fallbackAddress,
  });
  return { fired: true, hash, receipt, reason: "success" as const };
}
