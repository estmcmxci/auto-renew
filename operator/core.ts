// Shared operator logic. Written once, with each runtime
// (operator/node.ts for the local fork, operator/worker.ts for Sepolia) a
// thin entry point. Nothing here holds an RPC client, a key, or a clock —
// those are each entry point's job.
//
// Scope for now: read the expiry, decide whether a name is due. Building and
// submitting the renewal call, and writing the fallback address on a funding
// failure, come later (ERD.md 7.2 steps 3-5) — they need the contract
// change, which is still gated behind progress/contracts.md C1.

export interface WatchedName {
  /** The label only, e.g. "estmcmxci" for estmcmxci.eth. Not the full name. */
  label: string;
}

export interface ExpiryReader {
  /**
   * ITemporalRegistry.findExpiry(label), read from ETHRegistry. Seconds,
   * as a uint64. Wire this to the *_READ_RPC_URL endpoint, not the fork
   * endpoint: it is the single cheap view call config/README.md reserves
   * the keyless racer for. The one exception is the local-fork entry point
   * (operator/node.ts): there, "the chain" the operator watches IS the fork,
   * because the fork is what the time scrubber moves, so that entry point
   * reads this through the fork's own RPC URL instead. That choice belongs
   * to operator/node.ts (D8), not to this file.
   */
  findExpiry(label: string): Promise<bigint>;
}

/**
 * How long before expiry the operator starts attempting renewal, in
 * seconds.
 *
 * UNDECIDED, placeholder. Nothing in this project pins a number: ERD.md 7.2
 * says "If the expiry is inside the trigger window, build the renewal," and
 * The demo script says "At the trigger window the status changes to
 * renewing," but neither gives seconds, and it is not one of the two
 * contract-level caps that were decided. 30 days is written here only so `decideWindow` has
 * a default: the same order of magnitude as the 28-day post-expiry grace
 * period, short enough that a one-year renewal still spends most of its
 * life outside the window. Confirm or replace it once D8 exists and its
 * pacing can be checked against the fork's time scrubber; do not cite this
 * number as decided.
 */
export const DEFAULT_TRIGGER_WINDOW_SECONDS = 30 * 24 * 60 * 60; // 2,592,000

export interface WindowDecision {
  expiry: bigint;
  now: bigint;
  windowSeconds: number;
  /** True once `now` is within `windowSeconds` of expiry, or past it. */
  insideWindow: boolean;
  /** True once `expiry` has already passed. Renewal is still additive. */
  expired: boolean;
}

/**
 * Pure: takes expiry and the current time instead of reading either, so it
 * needs no Reader and no clock to test.
 */
export function decideWindow(
  expiry: bigint,
  now: bigint,
  windowSeconds: number = DEFAULT_TRIGGER_WINDOW_SECONDS,
): WindowDecision {
  const secondsUntilExpiry = expiry - now;
  return {
    expiry,
    now,
    windowSeconds,
    insideWindow: secondsUntilExpiry <= BigInt(windowSeconds),
    expired: secondsUntilExpiry <= 0n,
  };
}

/** Reads expiry for one watched name. Seconds, as returned by the chain. */
export async function readExpiry(
  reader: ExpiryReader,
  name: WatchedName,
): Promise<bigint> {
  return reader.findExpiry(name.label);
}
