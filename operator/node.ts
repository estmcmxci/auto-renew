// Node entry point for the local-fork demo. A thin runtime
// wrapper around operator/core.ts. A Cloudflare Worker cannot reach
// localhost, so this runtime exists only for the fork; operator/worker.ts
// (D9) is the Sepolia counterpart, from the same core.
//
// Scope, same as core.ts (D7): read expiry, decide the window, log the
// result. No signing, no submission, no fallback write — ERD.md 7.2 steps
// 3-5 need the contract change, still behind progress/contracts.md C1.

import { createPublicClient, http, parseAbi } from "viem";
import { getNetwork } from "../config/networks.ts";
import { decideWindow, readExpiry, type ExpiryReader } from "./core.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Set it in .env — see .env.example.`,
    );
  }
  return value;
}

const rpcUrl = requireEnv("LOCAL_RPC_URL");

const labels = requireEnv("WATCHED_LABELS")
  .split(",")
  .map((label) => label.trim())
  .filter((label) => label.length > 0);
if (labels.length === 0) {
  throw new Error(
    "WATCHED_LABELS is set but has no labels after parsing. " +
      "Give at least one, comma-separated.",
  );
}

const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 5_000);

const findExpiryAbi = parseAbi([
  "function findExpiry(string) view returns (uint64)",
]);

async function main(): Promise<void> {
  const client = createPublicClient({ transport: http(rpcUrl) });

  // Fail loudly if this is not actually pointed at a known ENSv2 deployment.
  // A fork keeps the forked chain's id (ERD.md 6.2), so this also catches
  // the exact failure this project already hit once: an unrelated anvil
  // squatting on the expected port (progress/contracts.md S2 — port 8545
  // held by a process with no ENSv2 code, this project's fork on 8546).
  const chainId = await client.getChainId();
  const net = getNetwork(chainId);
  console.log(
    `operator/node: connected to ${net.name} (chain ${chainId}) via ${rpcUrl}`,
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

  async function tick(): Promise<void> {
    // The fork's own clock, not the host machine's: the demo advances time
    // with evm_increaseTime/evm_mine on the fork (ERD.md 6.2), independently
    // of wall time, so "now" has to come from the chain being watched.
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
  }

  await tick();
  setInterval(() => {
    tick().catch((err) => console.error("operator/node: tick failed", err));
  }, pollIntervalMs);
}

main().catch((err) => {
  console.error("operator/node: fatal", err);
  process.exitCode = 1;
});
