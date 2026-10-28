// Proves operator/submit.ts's submitRealRenewal end to end against LIVE
// SEPOLIA, per the manager's explicit 2026-10-27 instruction, using the
// account's one remaining pre-approved renewal allowance (8,005,501 raw
// MockUSDC, exactly the live quote). NOT a fork check: every address below
// is the real ourStack/demoName from config/networks.ts, and every write
// is a real Sepolia transaction. Simulates via publicClient.simulateContract
// with the EXACT payload before sending anything, matching the manager's
// own methodology on the first live renewal (simulate, confirm success,
// then broadcast) -- never sent blind.
//
// Run with: bun operator/submit.live-check.ts

import { createPublicClient, http, keccak256, parseAbi, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia as sepoliaConfig } from "../config/networks.ts";
import { submitRealRenewal, REAL_EXECUTOR_ABI } from "./submit.ts";
import { buildRenewSessionPayload, type RenewSessionInputs } from "./session.ts";

function requireEnv(name: string): `0x${string}` {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v as `0x${string}`;
}
function requireEnvUrl(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}
const DEPLOYER_PRIVATE_KEY = requireEnv("DEPLOYER_PRIVATE_KEY");
const SESSION_PRIVATE_KEY = requireEnv("SESSION_PRIVATE_KEY");

const RPC_URL = requireEnvUrl("SEPOLIA_READ_RPC_URL");

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
]);
const REGISTRAR_ABI = parseAbi([
  "function getRenewPrice(string,uint64,address) view returns (uint256)",
]);
const REGISTRY_ABI = parseAbi([
  "function findExpiry(string) view returns (uint64)",
]);
const ACCOUNT_ABI = parseAbi(["function ownerAndSessionNonce() view returns (address,uint96)"]);
const VALIDATOR_ABI = parseAbi(["function INTENT_EXECUTOR() view returns (address)"]);

async function main() {
  const net = sepoliaConfig;
  if (!net.ourStack?.DemoAccount || !net.demoName) throw new Error("ourStack/demoName missing");

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const chainId = await publicClient.getChainId();
  if (chainId !== 11155111) throw new Error(`wrong chain: ${chainId}, expected live Sepolia`);

  const account = net.ourStack.DemoAccount;
  const validator = net.ourStack.HCAOwnerAndSessionValidator;
  const registrar = net.addresses.ETHRegistrar;
  const paymentToken = net.tokens.USDC;
  const nameOwner = net.demoName.owner;
  const label = net.demoName.label;
  const duration = 31557600n;

  const intentExecutor = await publicClient.readContract({
    address: validator, abi: VALIDATOR_ABI, functionName: "INTENT_EXECUTOR",
  });
  console.log(`intentExecutor (live read) = ${intentExecutor}`);

  const renewPrice = await publicClient.readContract({
    address: registrar, abi: REGISTRAR_ABI, functionName: "getRenewPrice",
    args: [label, duration, paymentToken],
  });
  console.log(`renewPrice (live) = ${renewPrice}`);

  const allowance = await publicClient.readContract({
    address: paymentToken, abi: ERC20_ABI, functionName: "allowance",
    args: [nameOwner, account],
  });
  const balance = await publicClient.readContract({
    address: paymentToken, abi: ERC20_ABI, functionName: "balanceOf", args: [nameOwner],
  });
  console.log(`allowance (live) = ${allowance}, balance (live) = ${balance}`);
  if (allowance < renewPrice || balance < renewPrice) {
    throw new Error("insufficient funding for a real renewal -- refusing to proceed");
  }

  const expiryBefore = await publicClient.readContract({
    address: net.addresses.ETHRegistry, abi: REGISTRY_ABI, functionName: "findExpiry", args: [label],
  });
  console.log(`expiry before (live) = ${expiryBefore}`);

  const [, sessionNonce] = await publicClient.readContract({
    address: account, abi: ACCOUNT_ABI, functionName: "ownerAndSessionNonce",
  });
  console.log(`sessionNonce (live) = ${sessionNonce}`);

  const block = await publicClient.getBlock();
  const validUntil = block.timestamp + 86_400n;
  const sessionKey = privateKeyToAccount(SESSION_PRIVATE_KEY).address;
  const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

  const deployerBalance = await publicClient.getBalance({ address: deployer.address });
  console.log(`deployer ETH balance (live) = ${deployerBalance}`);

  const inputs: RenewSessionInputs = {
    chainId: BigInt(chainId), account, validator, intentExecutor, registrar, paymentToken,
    nameOwner, sessionKey, label, duration, renewPrice,
    maxRenewSpend: renewPrice * 2n, // D9: 2x the live quote.
    validUntil, sessionNonce,
    nonce: BigInt(Date.now()),
    refund: {
      token: paymentToken, maxExchangeRate: 5_000_000_000n, maxGasOverhead: 100_000n,
      maxAmount: 25_000_000n,
    },
    sessionToEnableIndex: 1,
    sourceChain: { chainId: 84532n, sessionDigest: keccak256(toHex("source session")) },
  };
  const keys = { owner: DEPLOYER_PRIVATE_KEY, session: SESSION_PRIVATE_KEY };

  // Build once, by hand, purely to simulate before touching submit.ts's
  // send path -- buildRenewSessionPayload is deterministic (RFC6979
  // signing, no randomness), so submitRealRenewal will reproduce the
  // IDENTICAL payload from the same inputs when it runs for real below.
  const payload = await buildRenewSessionPayload({ ...inputs, settlement: "none" }, keys);

  console.log("simulating executeSinglechainOps before sending anything...");
  await publicClient.simulateContract({
    address: intentExecutor,
    abi: REAL_EXECUTOR_ABI,
    functionName: "executeSinglechainOps",
    account: deployer.address,
    args: [{
      account,
      nonce: inputs.nonce,
      ops: { data: payload.executorOpsData },
      signature: payload.accountSignature,
    }],
  });
  console.log("simulation succeeded. Broadcasting for real via submitRealRenewal...");

  const { hash } = await submitRealRenewal({
    rpcUrl: RPC_URL, inputs, keys, senderPrivateKey: DEPLOYER_PRIVATE_KEY,
  });
  console.log(`submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`status: ${receipt.status}, gasUsed: ${receipt.gasUsed}, block: ${receipt.blockNumber}`);
  console.log(`logs: ${receipt.logs.length}`);
  for (const log of receipt.logs) {
    console.log(`  ${log.address} topics=${JSON.stringify(log.topics)}`);
  }

  const expiryAfter = await publicClient.readContract({
    address: net.addresses.ETHRegistry, abi: REGISTRY_ABI, functionName: "findExpiry", args: [label],
  });
  const allowanceAfter = await publicClient.readContract({
    address: paymentToken, abi: ERC20_ABI, functionName: "allowance", args: [nameOwner, account],
  });
  console.log(`expiry after = ${expiryAfter}, delta = ${expiryAfter - expiryBefore}`);
  console.log(`allowance after = ${allowanceAfter}, decrement = ${allowance - allowanceAfter}`);
}

main().catch((err) => {
  console.error("submit.live-check: failed", err);
  process.exitCode = 1;
});
