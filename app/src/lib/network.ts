// The only place in app/src allowed to read VITE_CHAIN_ID or know a chain id.
//
// Every address the frontend needs comes from `network.addresses` or
// `network.tokens`, both read through config/networks.ts. Nothing in src may
// hardcode an address: import `network` from here instead.

import { getNetwork, type NetworkConfig } from "../../../config/networks";

export type { Address, NetworkConfig } from "../../../config/networks";
export {
  assertPreflight,
  needsVerification,
  preflight,
} from "../../../config/preflight";
export type { PreflightResult, Reader } from "../../../config/preflight";

function readChainId(): number {
  const raw = import.meta.env.VITE_CHAIN_ID;
  const chainId = Number(raw);
  if (!raw || !Number.isInteger(chainId)) {
    throw new Error(
      `VITE_CHAIN_ID is not a valid integer (got ${JSON.stringify(raw)}). ` +
        `Set it in app/.env — see app/.env.example.`,
    );
  }
  return chainId;
}

/** Throws on an unknown chain id. There is no fallback network. */
export const chainId: number = readChainId();

/** Throws via getNetwork() if chainId has no entry in config/networks.ts. */
export const network: NetworkConfig = getNetwork(chainId);
