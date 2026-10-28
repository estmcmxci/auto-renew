// One-off runner proving attemptRenewal + the attempt log end to end
// against the fork-local MOCK stack (see submit.mock-fork-check.ts's own
// header for which addresses are fork-only and why). Not part of the
// shipped path.
//
// Run with: bun operator/attempt.mock-fork-check.ts

import { createPublicClient, createWalletClient, http, keccak256, parseAbi, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia as sepoliaConfig } from "../config/networks.ts";
import { attemptRenewal } from "./attempt.ts";
import { readAttempts } from "./log.ts";
import type { RenewSessionInputs } from "./session.ts";

const RPC_URL = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8547";
if (RPC_URL.includes("8546")) throw new Error("Refusing 8546.");

const MOCK_INTENT_EXECUTOR = "0x901eD86584D06bD1f21627FC13cD01bd815e14FE" as const;
const FORK_VALIDATOR = "0x886642d239839e746Cfd327d9CFE7FC35b374aD0" as const;
const FORK_ACCOUNT = "0x299e8F22259E85263d0E641329D21cb8Bac103Fb" as const;

function requireEnv(name: string): `0x${string}` {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v as `0x${string}`;
}
const DEPLOYER_PRIVATE_KEY = requireEnv("DEPLOYER_PRIVATE_KEY");
const SESSION_PRIVATE_KEY = requireEnv("SESSION_PRIVATE_KEY");

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
]);
const REGISTRAR_ABI = parseAbi([
  "function getRenewPrice(string,uint64,address) view returns (uint256)",
]);
const ACCOUNT_ABI = parseAbi(["function ownerAndSessionNonce() view returns (address,uint96)"]);

async function buildBaseInputs() {
  const net = sepoliaConfig;
  if (!net.demoName) throw new Error("demoName missing");
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const chainId = await publicClient.getChainId();

  const registrar = net.addresses.ETHRegistrar;
  const paymentToken = net.tokens.USDC;
  const nameOwner = net.demoName.owner;
  const label = net.demoName.label;
  const duration = 31557600n; // D9.

  const renewPrice = await publicClient.readContract({
    address: registrar, abi: REGISTRAR_ABI, functionName: "getRenewPrice",
    args: [label, duration, paymentToken],
  });
  const [, sessionNonce] = await publicClient.readContract({
    address: FORK_ACCOUNT, abi: ACCOUNT_ABI, functionName: "ownerAndSessionNonce",
  });
  const block = await publicClient.getBlock();
  const validUntil = block.timestamp + 86_400n;
  const sessionKey = privateKeyToAccount(SESSION_PRIVATE_KEY).address;

  const inputs: RenewSessionInputs = {
    chainId: BigInt(chainId), account: FORK_ACCOUNT, validator: FORK_VALIDATOR,
    intentExecutor: MOCK_INTENT_EXECUTOR, registrar, paymentToken, nameOwner, sessionKey,
    label, duration, renewPrice, maxRenewSpend: renewPrice * 2n, validUntil, sessionNonce,
    nonce: BigInt(Date.now()), // unique per run, avoids any cross-run digest collision
    refund: {
      token: paymentToken, maxExchangeRate: 5_000_000_000n, maxGasOverhead: 100_000n,
      maxAmount: 25_000_000n,
    },
    sessionToEnableIndex: 1,
    sourceChain: { chainId: 84532n, sessionDigest: keccak256(toHex("source session")) },
  };
  return { inputs, publicClient, net };
}

async function ensureFunded(inputs: RenewSessionInputs, amount: bigint) {
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
  const client = createWalletClient({ account: deployer, transport: http(RPC_URL) });
  const balance = await publicClient.readContract({
    address: inputs.paymentToken, abi: ERC20_ABI, functionName: "balanceOf", args: [inputs.nameOwner],
  });
  if (balance < amount) {
    await client.writeContract({
      address: inputs.paymentToken, abi: ERC20_ABI, functionName: "mint", chain: null,
      args: [inputs.nameOwner, amount - balance],
    });
  }
  await client.writeContract({
    address: inputs.paymentToken, abi: ERC20_ABI, functionName: "approve", chain: null,
    args: [inputs.account, amount],
  });
}

async function drainAllowance(inputs: RenewSessionInputs) {
  const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
  const client = createWalletClient({ account: deployer, transport: http(RPC_URL) });
  await client.writeContract({
    address: inputs.paymentToken, abi: ERC20_ABI, functionName: "approve", chain: null,
    args: [inputs.account, 0n],
  });
}

async function main() {
  const { inputs, net } = await buildBaseInputs();
  const ethRegistry = net.addresses.ETHRegistry;
  const labelHash = net.demoName!.tokenId;

  console.log("--- scenario: positive ---");
  await ensureFunded(inputs, inputs.renewPrice);
  let result = await attemptRenewal({
    rpcUrl: RPC_URL, source: "mock-fork", transport: "mock", inputs,
    keys: { owner: DEPLOYER_PRIVATE_KEY, session: SESSION_PRIVATE_KEY },
    senderPrivateKey: DEPLOYER_PRIVATE_KEY, signedDuration: inputs.duration,
    requestedDuration: inputs.duration, ethRegistry, labelHash,
  });
  console.log(result);

  console.log("--- scenario: durationAboveCap (pre-check short-circuits, no tx) ---");
  const { inputs: inputs2 } = await buildBaseInputs();
  await ensureFunded(inputs2, inputs2.renewPrice);
  result = await attemptRenewal({
    rpcUrl: RPC_URL, source: "mock-fork", transport: "mock", inputs: inputs2,
    keys: { owner: DEPLOYER_PRIVATE_KEY, session: SESSION_PRIVATE_KEY },
    senderPrivateKey: DEPLOYER_PRIVATE_KEY, signedDuration: inputs2.duration,
    requestedDuration: inputs2.duration + 1n, ethRegistry, labelHash,
  });
  console.log(result);

  console.log("--- scenario: spendAboveCap (pre-check short-circuits, no tx) ---");
  const { inputs: inputs3 } = await buildBaseInputs();
  inputs3.maxRenewSpend = inputs3.renewPrice / 2n;
  await ensureFunded(inputs3, inputs3.renewPrice);
  result = await attemptRenewal({
    rpcUrl: RPC_URL, source: "mock-fork", transport: "mock", inputs: inputs3,
    keys: { owner: DEPLOYER_PRIVATE_KEY, session: SESSION_PRIVATE_KEY },
    senderPrivateKey: DEPLOYER_PRIVATE_KEY, signedDuration: inputs3.duration,
    requestedDuration: inputs3.duration, ethRegistry, labelHash,
  });
  console.log(result);

  console.log("--- scenario: funding source empty ---");
  const { inputs: inputs4 } = await buildBaseInputs();
  await drainAllowance(inputs4);
  result = await attemptRenewal({
    rpcUrl: RPC_URL, source: "mock-fork", transport: "mock", inputs: inputs4,
    keys: { owner: DEPLOYER_PRIVATE_KEY, session: SESSION_PRIVATE_KEY },
    senderPrivateKey: DEPLOYER_PRIVATE_KEY, signedDuration: inputs4.duration,
    requestedDuration: inputs4.duration, ethRegistry, labelHash,
  });
  console.log(result);
  // Re-fund for whoever runs this again.
  await ensureFunded(inputs4, inputs4.renewPrice);

  console.log("\n=== full log ===");
  for (const entry of readAttempts()) {
    const mark = entry.result === "success" ? "✓" : "✗";
    const dur = entry.durationSeconds ? `${Number(entry.durationSeconds) / 31557600}y` : "";
    console.log(`${mark} ${entry.kind}  ${entry.name}  ${dur}  [${entry.source}]`);
    console.log(`  ${entry.reason}`);
  }
}

main().catch((err) => {
  console.error("attempt.mock-fork-check: failed", err);
  process.exitCode = 1;
});
