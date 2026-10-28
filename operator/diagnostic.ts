// The rejection diagnostic, shared. ONE module, TWO callers: operator/
// attempt.ts (a Node publicClient) and the frontend (a wagmi hook), per
// the manager's 2026-10-27 instruction, mirroring how C4 ported the
// Solidity session-proof construction into session.ts once rather than
// writing it twice. Nothing here constructs a client or makes a network
// call -- it only builds the call's arguments and interprets the result,
// so each caller supplies its own execution mechanism (a Node client's
// `readContract`, or wagmi's `useReadContract` hook) around the same
// shared shape.
//
// Why this exists at all, not a shortcut: StandaloneSingleOwnerHCA's own
// `isValidSignature` wraps the validator in try/catch and returns the
// generic ERC-1271 failure value on ANY revert, including a policy
// rejection (demo.md O1, 2026-10-27). Calling the validator's own
// `isValidSignatureWithSender` directly, with the intent executor passed
// as an explicit `sender` argument (not `msg.sender`), bypasses that
// wrapper and surfaces the real revert data.
//
// What this does NOT do: decide WHICH check will fail. `PolicyRuleFailed`
// carries no arguments and is reused for owner binding, duration, and
// spend, so the contract's own revert data confirms a rejection is REAL,
// not WHICH one it is. `classifyExpectedRejection` below is the caller's
// own attribution, from knowing which single input it deliberately pushed
// out of bounds -- never hidden as if the contract said it.

import { parseAbi } from "viem";
import type { Address, Hex } from "viem";

export const VALIDATOR_DIAGNOSTIC_ABI = parseAbi([
  "function isValidSignatureWithSender(address sender, bytes32 hash, bytes data) view returns (bytes4)",
]);

/** `cast keccak "PolicyRuleFailed()"`, confirmed live (demo.md O1): the
 * validator's one generic policy-rejection error. */
export const POLICY_RULE_FAILED_SELECTOR: Hex = "0xe50c42ea";

export interface DiagnosticCallArgs {
  validator: Address;
  intentExecutor: Address;
  account: Address;
  digest: Hex;
  envelope: Hex;
}

/**
 * The exact call shape both a Node `publicClient.readContract(...)` and a
 * wagmi `useReadContract(...)` hook accept -- spread this object into
 * either. `account` here is the HCA the validator's own
 * `_ownerAndSessionNonce(msg.sender)` needs as the caller context, NOT
 * `sender`, which is the explicit function argument naming the intent
 * executor. Confusing the two gives a misleading result (demo.md O1
 * caught this once already): the validator would query the wrong
 * address's owner/nonce instead of the HCA's.
 */
export function buildDiagnosticReadArgs(args: DiagnosticCallArgs) {
  return {
    address: args.validator,
    abi: VALIDATOR_DIAGNOSTIC_ABI,
    functionName: "isValidSignatureWithSender" as const,
    args: [args.intentExecutor, args.digest, args.envelope] as const,
    account: args.account,
  };
}

/**
 * Extracts the raw revert selector from a viem error, the same shape
 * whether it came from a Node client or a wagmi hook's `error` state
 * (both wrap the underlying JSON-RPC error the same way). Returns null
 * when nothing decodable was found -- the caller decides what that means
 * (an unexpected shape, not necessarily "no error").
 */
export function decodeRevertSelector(err: unknown): Hex | null {
  const selector = (err as { walk?: (fn: (e: unknown) => unknown) => { data?: unknown } })
    ?.walk?.((e) => (e as { data?: unknown })?.data)?.data;
  return typeof selector === "string" && selector.startsWith("0x")
    ? (selector as Hex)
    : null;
}

export interface RejectionChecks {
  ownerMatches: boolean;
  durationOk: boolean;
  spendOk: boolean;
}

/**
 * The human-readable reason, DEMO-SCRIPT.md's own phrasing, for whichever
 * single check the caller already knows is violated. Returns null when
 * nothing is expected to fail -- the caller should not be calling this in
 * that case.
 */
export function classifyExpectedRejection(checks: RejectionChecks): string | null {
  if (!checks.ownerMatches) return "latestOwner does not match the session owner";
  if (!checks.durationOk) return "duration above the cap";
  if (!checks.spendOk) return "spend above the cap";
  return null;
}
