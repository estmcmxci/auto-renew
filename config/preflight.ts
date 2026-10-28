// Startup assertions.
//
// config/networks.ts holds what we believe. This file checks the chain agrees.
// Run it before the demo and before any Sepolia run. A drift must stop the
// run, not change the numbers on screen.

import { getNetwork, type NetworkConfig } from "./networks";

export interface Reader {
  /** Reads a uint from a contract. Supply a viem or ethers wrapper. */
  readUint(address: string, signature: string): Promise<bigint>;
  /** Calls isPaymentToken(address) on the oracle. */
  isPaymentToken(oracle: string, token: string): Promise<boolean>;
  /** The chain id the reader is actually connected to. */
  chainId(): Promise<number>;
}

export interface PreflightResult {
  network: string;
  chainId: number;
  checks: { name: string; expected: string; actual: string; ok: boolean }[];
  ok: boolean;
}

export async function preflight(
  reader: Reader,
  expectedChainId: number,
): Promise<PreflightResult> {
  const actualChainId = await reader.chainId();
  if (actualChainId !== expectedChainId) {
    throw new Error(
      `Connected to chain ${actualChainId}, expected ${expectedChainId}. ` +
        `Check the RPC. A fork keeps the forked chain's id.`,
    );
  }

  const net = getNetwork(expectedChainId);
  const checks: PreflightResult["checks"] = [];

  const add = (name: string, expected: unknown, actual: unknown) =>
    checks.push({
      name,
      expected: String(expected),
      actual: String(actual),
      ok: String(expected) === String(actual),
    });

  if (net.expect.registrarGracePeriod !== null) {
    const got = await reader.readUint(
      net.addresses.ETHRegistrar,
      "GRACE_PERIOD()(uint64)",
    );
    add("ETHRegistrar.GRACE_PERIOD", net.expect.registrarGracePeriod, got);
  }

  if (net.expect.renewerGracePeriod !== null) {
    const got = await reader.readUint(
      net.addresses.ETHRenewerV1,
      "GRACE_PERIOD()(uint64)",
    );
    add("ETHRenewerV1.GRACE_PERIOD", net.expect.renewerGracePeriod, got);
  }

  if (net.expect.acceptedTokens !== null) {
    for (const [symbol, token] of Object.entries(net.tokens)) {
      const want = net.expect.acceptedTokens.includes(symbol);
      const got = await reader.isPaymentToken(
        net.addresses.StandardRentPriceOracle,
        token,
      );
      add(`oracle accepts ${symbol}`, want, got);
    }
  }

  return {
    network: net.name,
    chainId: expectedChainId,
    checks,
    ok: checks.every((c) => c.ok),
  };
}

/** Formats a result and throws when anything drifted. */
export function assertPreflight(r: PreflightResult): void {
  if (r.ok) return;
  const failed = r.checks
    .filter((c) => !c.ok)
    .map((c) => `  ${c.name}: expected ${c.expected}, got ${c.actual}`)
    .join("\n");
  throw new Error(
    `Preflight failed on ${r.network} (chain ${r.chainId}):\n${failed}\n\n` +
      `The deployment changed, or config/networks.ts is stale. Re-read the ` +
      `deployment records on post-audit-2 and update VERIFY.md. Do not edit ` +
      `the expectations to make this pass.`,
  );
}

/** True when expectations have never been recorded for a network. */
export function needsVerification(net: NetworkConfig): boolean {
  return net.expect.verifiedAt === null;
}
