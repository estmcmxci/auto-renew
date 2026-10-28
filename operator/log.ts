// ERD.md 7.2 step 5: "Record every attempt and its result for the frontend."
// ERD.md 8.2 / DEMO-SCRIPT.md: the right pane's log, one line per attempt,
// exactly in this shape:
//   ✓ renew  <name>  1 year   5.00 USDC
//     owner matches · within duration cap · within spend cap
// or
//   ✗ renew  <name>  1 year
//     rejected · duration above the cap
//
// AGENTS.md hard rule 4: every entry must come from a contract event or a
// call result, never from frontend state. This file is the operator-side
// half: it only ever writes what submit.ts and attempt.ts give it after a
// real read or a real (or dry-run-confirmed) call; it builds no field out
// of thin air.
//
// Append-only JSON Lines, one object per line, so a crash mid-write loses
// at most the last unflushed entry, not the file.

import { appendFileSync, readFileSync, existsSync } from "node:fs";
import type { Address, Hex } from "viem";

export type AttemptKind = "renew" | "setAddress";
export type AttemptResult = "success" | "rejected";

/** Which stack produced this entry. Never let one be read as the other. */
export type AttemptSource = "mock-fork" | "live-sepolia";

/**
 * Where `reason` came from. The manager's 2026-10-27 instruction: the right
 * pane must label this, or a reviewer who mistakes an operator-computed
 * reason for a contract one stops trusting the whole pane.
 *   - "contract-revert": the deployed validator itself reverted with this
 *     reason (PolicyRuleFailed, confirmed via a direct eth_call against the
 *     validator, sender set to the intent executor -- see attempt.ts).
 *   - "live-read": no contract call rejects this; the operator read live
 *     state (balance, allowance) and compared it itself. Still a call
 *     result, per AGENTS.md hard rule 4, just not a revert.
 *   - "tx-receipt": a real transaction's own status/logs.
 */
export type AttemptReasonSource = "contract-revert" | "live-read" | "tx-receipt";

export interface AttemptLogEntry {
  timestamp: string;
  source: AttemptSource;
  kind: AttemptKind;
  name: string;
  result: AttemptResult;
  /** DEMO-SCRIPT.md's second line, e.g. "owner matches · within duration cap · within spend cap". */
  reason: string;
  reasonSource: AttemptReasonSource;
  /** Only set when a transaction actually went to the chain. */
  txHash?: Hex;
  blockNumber?: string;
  /** Renewal duration in seconds, when this is a renew attempt. */
  durationSeconds?: string;
  /** Exact amount pulled, when this is a successful renew. Smallest token unit. */
  amount?: string;
  /** The resolved record value, when this is a setAddress attempt. */
  address?: Address;
}

const LOG_PATH = new URL("./attempts.log.jsonl", import.meta.url).pathname;

/** The one write path. Every field must already be known, not derived here. */
export function appendAttempt(entry: AttemptLogEntry): void {
  appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n", "utf8");
}

export function readAttempts(): AttemptLogEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  return readFileSync(LOG_PATH, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as AttemptLogEntry);
}
