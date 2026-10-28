// Proves operator/fallback.ts's submitFallback end to end against LIVE
// SEPOLIA: diagnostic first (read-only, mirrors operator/c8-probe.ts's
// proven case B), then simulateContract, then a real send, only if each
// prior step succeeded. Writes FALLBACK_ADDRESS from .env into
// "autorenewdemo.eth"'s address record on the resolver
// progress/evidence.md E9 deployed and granted the role on.
//
// Run with: bun operator/fallback.live-check.ts

import { createPublicClient, decodeEventLog, http, parseAbi, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia as sepoliaConfig } from "../config/networks.ts";
import { buildFallbackPayload, submitFallback, type FallbackSessionInputs } from "./fallback.ts";
import { REAL_EXECUTOR_ABI } from "./submit.ts";

// IAddressSetter.sol:14 (declaration, not just the emit site): `recordId`
// is `indexed`. Missing that on the first attempt did not change the
// topic0 selector (computed from types only) but did make decodeEventLog
// fail silently inside this script's own try/catch -- caught by checking
// the raw receipt log against a `cast keccak` of the signature rather
// than assuming the ABI was right because nothing threw loudly.
const ADDRESS_UPDATED_EVENT = parseAbiItem(
  "event AddressUpdated(uint256 indexed recordId, uint256 coinType, bytes addressBytes)",
);

function requireEnv(name: string): `0x${string}` {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v as `0x${string}`;
}
const DEPLOYER_PRIVATE_KEY = requireEnv("DEPLOYER_PRIVATE_KEY");
const SESSION_PRIVATE_KEY = requireEnv("SESSION_PRIVATE_KEY");
const FALLBACK_ADDRESS = requireEnv("FALLBACK_ADDRESS");

function requireEnvUrl(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}
const RPC_URL = requireEnvUrl("SEPOLIA_READ_RPC_URL");

const ACCOUNT_ABI = parseAbi(["function ownerAndSessionNonce() view returns (address,uint96)"]);
const VALIDATOR_DIAG_ABI = parseAbi([
  "function isValidSignatureWithSender(address sender, bytes32 hash, bytes data) view returns (bytes4)",
]);

async function main() {
  const net = sepoliaConfig;
  if (!net.ourStack?.DemoAccount || !net.demoName?.resolver) {
    throw new Error("ourStack.DemoAccount or demoName.resolver missing -- run E9 first");
  }
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const chainId = await publicClient.getChainId();
  if (chainId !== 11155111) throw new Error(`wrong chain: ${chainId}`);

  const account = net.ourStack.DemoAccount;
  const validator = net.ourStack.HCAOwnerAndSessionValidator;
  const intentExecutor = await publicClient.readContract({
    address: validator,
    abi: parseAbi(["function INTENT_EXECUTOR() view returns (address)"]),
    functionName: "INTENT_EXECUTOR",
  });
  const resolver = net.demoName.resolver;
  const nameOwner = net.demoName.owner;
  const sessionKey = privateKeyToAccount(SESSION_PRIVATE_KEY).address;
  const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

  const [, sessionNonce] = await publicClient.readContract({
    address: account, abi: ACCOUNT_ABI, functionName: "ownerAndSessionNonce",
  });
  const block = await publicClient.getBlock();

  // Built ONCE. The diagnostic, the simulation, and the real send below
  // all reuse these exact inputs -- a fresh nonce at each step would sign
  // a different digest each time, so the earlier checks would prove
  // nothing about what actually gets sent.
  const inputs: FallbackSessionInputs = {
    chainId: BigInt(chainId), account, validator, intentExecutor, resolver,
    nameOwner, sessionKey, label: net.demoName.label, coinType: 60n,
    fallbackAddress: FALLBACK_ADDRESS, validUntil: block.timestamp + 86_400n,
    sessionNonce, nonce: BigInt(Date.now()),
  };
  const keys = { owner: DEPLOYER_PRIVATE_KEY, session: SESSION_PRIVATE_KEY };
  const payload = await buildFallbackPayload(inputs, keys);

  console.log("calling isValidSignatureWithSender directly (read-only, sends nothing)...");
  let accepted = false;
  try {
    const result = await publicClient.readContract({
      address: validator,
      abi: VALIDATOR_DIAG_ABI,
      functionName: "isValidSignatureWithSender",
      args: [intentExecutor, payload.digest, payload.envelope],
      account,
    });
    console.log(`ACCEPTED: ${result}`);
    accepted = true;
  } catch (err: any) {
    const sel = err?.walk?.((e: any) => e?.data)?.data;
    console.log(`REFUSED: selector=${sel}`);
  }
  if (!accepted) {
    console.log("not proceeding: the diagnostic did not accept it.");
    return;
  }

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
  console.log("simulation succeeded. Broadcasting for real via submitFallback...");

  const { hash } = await submitFallback({
    rpcUrl: RPC_URL, inputs, keys, senderPrivateKey: DEPLOYER_PRIVATE_KEY,
  });
  console.log(`submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`status: ${receipt.status}, gasUsed: ${receipt.gasUsed}, block: ${receipt.blockNumber}`);

  let found = false;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: [ADDRESS_UPDATED_EVENT], data: log.data, topics: log.topics });
      console.log(`AddressUpdated: recordId=${decoded.args.recordId} coinType=${decoded.args.coinType} addressBytes=${decoded.args.addressBytes}`);
      if (decoded.args.addressBytes.toLowerCase() === FALLBACK_ADDRESS.toLowerCase()) found = true;
    } catch {
      // not this event, skip
    }
  }
  console.log(`addressBytes matches FALLBACK_ADDRESS: ${found}`);
}

main().catch((err) => {
  console.error("fallback.live-check: failed", err);
  process.exitCode = 1;
});
