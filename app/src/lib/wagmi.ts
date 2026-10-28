// Wagmi config. The browser's only way to the chain -- DECISIONS.md D2,
// "no server", and the manager's 2026-10-27 confirmation: the live
// rejection beat is a live call the browser makes itself, not a log a
// server hands it.
//
// Chain metadata (id, name, native currency) comes from viem/chains;
// `network`'s chain id already asserted against config/networks.ts in
// network.ts. Only the RPC URL is overridden, to VITE_RPC_URL, which
// points at the local fork for the demo or live Sepolia -- never a
// secret: app/.env.example's own warning is that Vite inlines every
// VITE_* variable into the public bundle.

import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { chainId } from "./network";

function readRpcUrl(): string {
  const url = import.meta.env.VITE_RPC_URL;
  if (!url) {
    throw new Error("VITE_RPC_URL is not set. Set it in app/.env — see app/.env.example.");
  }
  return url;
}

const rpcUrl = readRpcUrl();

export const wagmiConfig =
  chainId === mainnet.id
    ? createConfig({ chains: [mainnet], transports: { [mainnet.id]: http(rpcUrl) } })
    : chainId === sepolia.id
      ? createConfig({ chains: [sepolia], transports: { [sepolia.id]: http(rpcUrl) } })
      : (() => {
          throw new Error(`No wagmi chain for id ${chainId}. Add it here, from config/networks.ts's own set.`);
        })();
