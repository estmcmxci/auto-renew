// Cloudflare Worker entry point for the Sepolia leg. A thin
// runtime wrapper around core.ts, the twin of the local-fork entry point
// (operator/node.ts, D8). Runs on a cron trigger; a Worker cannot reach
// localhost, which is why the fork needs its own runtime instead of this one.
//
// Scope, same as D7/D8: read expiry, decide the window, log the result. No
// signing, no submission, no fallback write — ERD.md 7.2 steps 3-5 need the
// contract change, still behind progress/contracts.md C1.

import { createPublicClient, http, parseAbi } from "viem";
import { getNetwork } from "../config/networks.ts";
import { decideWindow, readExpiry, type ExpiryReader } from "./core.ts";

interface Env {
  SEPOLIA_READ_RPC_URL: string;
  WATCHED_LABELS: string;
}

const findExpiryAbi = parseAbi([
  "function findExpiry(string) view returns (uint64)",
]);

function parseLabels(raw: string): string[] {
  const labels = raw
    .split(",")
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
  if (labels.length === 0) {
    throw new Error(
      "WATCHED_LABELS is set but has no labels after parsing. " +
        "Give at least one, comma-separated.",
    );
  }
  return labels;
}

export default {
  async scheduled(
    _event: unknown,
    env: Env,
    _ctx: unknown,
  ): Promise<void> {
    if (!env.SEPOLIA_READ_RPC_URL) {
      throw new Error("SEPOLIA_READ_RPC_URL is not set.");
    }
    const labels = parseLabels(env.WATCHED_LABELS ?? "");

    const client = createPublicClient({
      transport: http(env.SEPOLIA_READ_RPC_URL),
    });

    // Fail loudly if this is not actually pointed at a known ENSv2
    // deployment — the same guard operator/node.ts uses (D8).
    const chainId = await client.getChainId();
    const net = getNetwork(chainId);
    console.log(
      `operator/worker: connected to ${net.name} (chain ${chainId}) via ` +
        env.SEPOLIA_READ_RPC_URL,
    );

    const reader: ExpiryReader = {
      async findExpiry(label) {
        return client.readContract({
          address: net.addresses.ETHRegistry,
          abi: findExpiryAbi,
          functionName: "findExpiry",
          args: [label],
        });
      },
    };

    // Sepolia's own clock, read the same way operator/node.ts reads the
    // fork's: from the chain being watched, not the Worker's host clock.
    // The two happen to track each other closely here, since there is no
    // time-warp on this leg, but the invariant stays uniform across both
    // entry points.
    const block = await client.getBlock();
    const now = block.timestamp;
    for (const label of labels) {
      const expiry = await readExpiry(reader, { label });
      const decision = decideWindow(expiry, now);
      console.log(
        `[${new Date(Number(now) * 1000).toISOString()}] ${label}: ` +
          `expiry=${new Date(Number(expiry) * 1000).toISOString()} ` +
          `insideWindow=${decision.insideWindow} expired=${decision.expired}`,
      );
    }
  },
};
