// One-off runner proving submit.ts end to end against a FORK-LOCAL stack
// bound to the MOCK MockRegistrationIntentExecutor. NOT ourStack: the live
// DemoAccount's validator is bound to the real RHINESTONE_INTENT_EXECUTOR,
// which demo.md O1 (2026-10-27) proved empirically does not expose
// executeWithSession/executeWithSessionAndRefund (identical empty-data
// revert to a deliberately nonexistent selector). Per the manager's
// 2026-10-27 direction, a fresh validator/factory/implementation/account
// bound to the local mock was deployed directly with forge create/cast
// send (bypassing rocketh, same technique progress/evidence.md E6 used for
// three of its five ourStack contracts), ONLY on the fork at 8547. These
// addresses exist ONLY on that disposable fork and must never be read as
// config/networks.ts values or cited as live Sepolia addresses.
//
// EVERY RESULT BELOW IS FROM THE MOCK EXECUTOR ON A FORK. It proves the
// validator's policy logic and submit.ts's construction are correct. It
// does NOT prove the real Rhinestone executor accepts anything -- that is
// a separate, open question contracts is investigating via
// script/liveHcaRhinestoneRegistration.ts, not duplicated here.
//
// Run with: bun operator/submit.mock-fork-check.ts

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia as sepoliaConfig } from "../config/networks.ts";
import { submitMockRenewal } from "./submit.ts";
import { buildRenewSessionPayload, type RenewSessionInputs } from "./session.ts";

const VALIDATOR_DIAG_ABI = parseAbi([
  "function isValidSignatureWithSender(address sender, bytes32 hash, bytes data) view returns (bytes4)",
]);

const RPC_URL = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8547";
if (RPC_URL.includes("8546")) {
  throw new Error("Refusing 8546: not this project's fork for this check.");
}

// Fork-local only. Deployed 2026-10-27 with forge create against 8547.
// MockRegistrationIntentExecutor has no on-chain record outside this file;
// re-deploy and update these if the fork is restarted.
const MOCK_INTENT_EXECUTOR = "0x901eD86584D06bD1f21627FC13cD01bd815e14FE" as const;
const FORK_VALIDATOR = "0x886642d239839e746Cfd327d9CFE7FC35b374aD0" as const;
const FORK_FACTORY = "0x39777e394ECA2318043a3d379b60aE0D58bcdC49" as const;
const FORK_IMPLEMENTATION = "0x9C1297377312427F025992eE060b54aC538147C8" as const;
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
const ACCOUNT_ABI = parseAbi([
  "function ownerAndSessionNonce() view returns (address,uint96)",
]);
const REGISTRY_ABI = parseAbi([
  "function findExpiry(string) view returns (uint64)",
]);

type Scenario = "positive" | "durationAboveCap" | "spendAboveCap";

async function buildInputs(scenario: Scenario) {
  const net = sepoliaConfig;
  if (!net.demoName) throw new Error("demoName missing");

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const chainId = await publicClient.getChainId();
  if (chainId !== net.chainId) throw new Error(`chain id mismatch: ${chainId}`);

  const registrar = net.addresses.ETHRegistrar;
  const paymentToken = net.tokens.USDC;
  const nameOwner = net.demoName.owner;
  const label = net.demoName.label;

  const liveDuration = 31557600n; // D9.
  const renewPrice = await publicClient.readContract({
    address: registrar,
    abi: REGISTRAR_ABI,
    functionName: "getRenewPrice",
    args: [label, liveDuration, paymentToken],
  });

  const [, sessionNonce] = await publicClient.readContract({
    address: FORK_ACCOUNT,
    abi: ACCOUNT_ABI,
    functionName: "ownerAndSessionNonce",
  });

  const block = await publicClient.getBlock();
  const validUntil = block.timestamp + 86_400n;
  const sessionKey = privateKeyToAccount(SESSION_PRIVATE_KEY).address;

  // Fund + approve on the fork only, idempotent (mints/approves only the
  // shortfall). Mirrors progress/evidence.md E5/E6.5's real pattern.
  const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
  const deployerClient = createWalletClient({ account: deployer, transport: http(RPC_URL) });
  const balance = await publicClient.readContract({
    address: paymentToken, abi: ERC20_ABI, functionName: "balanceOf", args: [nameOwner],
  });
  if (balance < renewPrice) {
    await deployerClient.writeContract({
      address: paymentToken, abi: ERC20_ABI, functionName: "mint",
      chain: null,
      args: [nameOwner, renewPrice - balance],
    });
  }
  const allowance = await publicClient.readContract({
    address: paymentToken, abi: ERC20_ABI, functionName: "allowance",
    args: [nameOwner, FORK_ACCOUNT],
  });
  if (allowance < renewPrice) {
    await deployerClient.writeContract({
      address: paymentToken, abi: ERC20_ABI, functionName: "approve",
      chain: null,
      args: [FORK_ACCOUNT, renewPrice],
    });
  }

  let duration = liveDuration;
  let maxRenewSpend = renewPrice * 2n; // D9: 2x the live quote.

  if (scenario === "durationAboveCap") {
    // The SESSION's signed policy still says liveDuration (maxRenewSpend
    // computed against it); the EXECUTION batch asks for one second more.
    // _checkRenewCall compares rd.duration against renewPolicy.duration,
    // so this must mismatch, not just exceed a numeric cap -- D4/D7: the
    // duration is fixed, not a maximum, so EITHER direction must revert.
  }
  if (scenario === "spendAboveCap") {
    maxRenewSpend = renewPrice / 2n; // below price -> getRenewPrice check must refuse it.
  }

  const inputs: RenewSessionInputs = {
    chainId: BigInt(chainId),
    account: FORK_ACCOUNT,
    validator: FORK_VALIDATOR,
    intentExecutor: MOCK_INTENT_EXECUTOR,
    registrar,
    paymentToken,
    nameOwner,
    sessionKey,
    label,
    duration: scenario === "durationAboveCap" ? duration + 1n : duration,
    renewPrice,
    maxRenewSpend,
    validUntil,
    sessionNonce,
    nonce: scenario === "positive" ? 10n : scenario === "durationAboveCap" ? 11n : 12n,
    refund: {
      token: paymentToken,
      maxExchangeRate: 5_000_000_000n,
      maxGasOverhead: 100_000n,
      maxAmount: 25_000_000n,
    },
    sessionToEnableIndex: 1,
    sourceChain: { chainId: 84532n, sessionDigest: keccak256(toHex("source session")) },
  };

  return { inputs, publicClient, registrar, label };
}

async function runScenario(scenario: Scenario) {
  console.log(`\n=== scenario: ${scenario} (MOCK executor, fork 8547) ===`);
  const { inputs, publicClient, registrar, label } = await buildInputs(scenario);

  let expiryBefore: bigint | undefined;
  if (scenario === "positive") {
    expiryBefore = await publicClient.readContract({
      address: inputs.registrar === registrar ? sepoliaConfig.addresses.ETHRegistry : registrar,
      abi: REGISTRY_ABI,
      functionName: "findExpiry",
      args: [label],
    });
    console.log(`expiry before: ${expiryBefore} (${new Date(Number(expiryBefore) * 1000).toISOString()})`);
  }

  const allowanceBefore = await publicClient.readContract({
    address: inputs.paymentToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [inputs.nameOwner, inputs.account],
  });

  // Diagnostic only, not part of submit.ts's path: the account's own
  // isValidSignature wraps the validator call in try/catch and returns the
  // generic ERC-1271 failure value on ANY revert (StandaloneSingleOwnerHCA
  // .sol:280-290), and the mock executor turns that into its own generic
  // InvalidSignature() -- so a POLICY revert (PolicyRuleFailed) and a BAD
  // SIGNATURE are indistinguishable from outside the account. Calling the
  // validator's isValidSignatureWithSender directly, with the intent
  // executor passed as an explicit argument (not msg.sender), bypasses
  // that wrapper and surfaces the real revert reason.
  if (scenario !== "positive") {
    const payload = await buildRenewSessionPayload(inputs, {
      owner: DEPLOYER_PRIVATE_KEY, session: SESSION_PRIVATE_KEY,
    });
    try {
      await publicClient.readContract({
        address: inputs.validator,
        abi: VALIDATOR_DIAG_ABI,
        functionName: "isValidSignatureWithSender",
        args: [inputs.intentExecutor, payload.digest, payload.envelope],
        // HCAOwnerAndSessionValidator._ownerAndSessionNonce reads
        // msg.sender as the account to query. Called normally, msg.sender
        // IS the account (the account calls its own validator). A plain
        // call with no `account` set defaults to no sender at all, which
        // queries the wrong address and gives a misleading result -- an
        // eth_call accepts any `from` with no signature needed, so set it
        // explicitly rather than impersonate.
        account: inputs.account,
      });
      console.log("DIAGNOSTIC: validator call did not revert (unexpected for a negative case)");
    } catch (diagErr: any) {
      const raw = diagErr?.cause?.data ?? diagErr?.data ?? diagErr?.cause?.cause?.data;
      console.log(`DIAGNOSTIC raw validator revert data: ${JSON.stringify(raw)}`);
      console.log(`DIAGNOSTIC shortMessage: ${diagErr?.shortMessage}`);
      console.log(`DIAGNOSTIC walk: ${JSON.stringify(diagErr?.walk?.((e: any) => e?.data)?.data)}`);
    }
  }

  try {
    const { hash, payload } = await submitMockRenewal({
      rpcUrl: RPC_URL,
      inputs,
      keys: { owner: DEPLOYER_PRIVATE_KEY, session: SESSION_PRIVATE_KEY },
      senderPrivateKey: DEPLOYER_PRIVATE_KEY, // session key itself holds no ETH; see demo.md O1.
    });
    console.log(`submitted: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`status: ${receipt.status}, gasUsed: ${receipt.gasUsed}`);
    console.log(`logs emitted: ${receipt.logs.length}`);
    for (const log of receipt.logs) {
      console.log(`  ${log.address} topics=${JSON.stringify(log.topics)}`);
    }
    if (scenario === "positive") {
      const expiryAfter = await publicClient.readContract({
        address: sepoliaConfig.addresses.ETHRegistry,
        abi: REGISTRY_ABI,
        functionName: "findExpiry",
        args: [label],
      });
      console.log(`expiry after: ${expiryAfter} (${new Date(Number(expiryAfter) * 1000).toISOString()})`);
      console.log(`expiry delta: ${expiryAfter - (expiryBefore ?? 0n)} seconds`);
      const allowanceAfter = await publicClient.readContract({
        address: inputs.paymentToken, abi: ERC20_ABI, functionName: "allowance",
        args: [inputs.nameOwner, inputs.account],
      });
      console.log(`allowance before: ${allowanceBefore}, after: ${allowanceAfter}, decrement: ${allowanceBefore - allowanceAfter}`);
      console.log(`envelope length: ${(payload.envelope.length - 2) / 2} bytes`);
    } else {
      console.log("UNEXPECTED: negative scenario did not revert.");
    }
  } catch (err: any) {
    const data = err?.cause?.data ?? err?.data ?? err?.details ?? String(err);
    console.log(`reverted. data/detail: ${JSON.stringify(data)}`);
    if (scenario !== "positive") {
      const msg = String(err?.shortMessage ?? err ?? "");
      console.log(`PolicyRuleFailed expected; message contains it: ${msg.includes("PolicyRuleFailed")}`);
    } else {
      console.log("UNEXPECTED: positive scenario reverted.");
      throw err;
    }
  }
}

/**
 * durationAboveCap needs a genuine mismatch between the SIGNED session
 * policy (renewalDuration) and the EXECUTED batch's rd.duration, per D4/D7:
 * the duration is fixed, not a maximum, so a value that differs in EITHER
 * direction must revert. buildRenewSessionPayload ties both to one
 * `inputs.duration` field, so a valid-but-mismatched case needs the
 * lower-level exports directly: sign the proof for the REAL duration, but
 * execute a batch asking for one second more. This is more realistic than
 * it looks: it is what a batch built from a replayed/edited signature-less
 * calldata would produce, not just a confused caller.
 */
async function runDurationMismatchCheck() {
  console.log(`\n=== scenario: durationAboveCap (MOCK executor, fork 8547) ===`);
  const { inputs } = await buildInputs("positive");
  const publicClient = createPublicClient({ transport: http(RPC_URL) });

  const { buildRenewSessionProof, renewGasRefund, renewExecutions, encodeExecutions, operationHash, singleChainDigest, renewEnvelope, signRhinestoneMessage, accountSignature } = await import("./session.ts");

  const signedDuration = inputs.duration; // what the owner actually authorized
  const executedDuration = inputs.duration + 1n; // what the batch actually asks for

  const { proof, permissionId } = await buildRenewSessionProof(
    { ...inputs, duration: signedDuration },
    DEPLOYER_PRIVATE_KEY,
  );
  const gasRefund = renewGasRefund(proof);
  const executions = renewExecutions({
    paymentToken: inputs.paymentToken,
    registrar: inputs.registrar,
    nameOwner: inputs.nameOwner,
    account: inputs.account,
    label: inputs.label,
    duration: executedDuration, // the mismatch
    renewPrice: inputs.renewPrice,
  });
  const operationData = encodeExecutions(executions);
  const digest = singleChainDigest({
    chainId: inputs.chainId,
    intentExecutor: inputs.intentExecutor,
    account: inputs.account,
    nonce: inputs.nonce,
    operationHash: operationHash(executions),
    gasRefund,
  });
  const envelope = renewEnvelope({
    permissionId,
    proof,
    nonce: inputs.nonce,
    gasRefund,
    operationData,
    sessionSignature: await signRhinestoneMessage(SESSION_PRIVATE_KEY, digest),
  });

  console.log("DIAGNOSTIC: calling the validator directly (bypasses the account's ERC-1271 swallow wrapper)");
  try {
    await publicClient.readContract({
      address: inputs.validator,
      abi: VALIDATOR_DIAG_ABI,
      functionName: "isValidSignatureWithSender",
      args: [inputs.intentExecutor, digest, envelope],
      account: inputs.account,
    });
    console.log("DIAGNOSTIC: did not revert (unexpected)");
  } catch (diagErr: any) {
    const sel = diagErr?.walk?.((e: any) => e?.data)?.data;
    console.log(`DIAGNOSTIC raw validator revert selector: ${sel}`);
  }

  console.log("Submitting the real transaction through the executor (expect the generic swallow):");
  const signature = accountSignature(envelope);
  const sender = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
  const client = createWalletClient({ account: sender, transport: http(RPC_URL) });
  const executorAbi = parseAbi([
    "function executeWithSessionAndRefund(address account, (address target, uint256 value, bytes callData)[] executions, uint256 nonce, (address token, uint256 exchangeRate, uint256 overhead) gasRefund, bytes signature) returns (bytes[])",
  ]);
  try {
    const hash = await client.writeContract({
      address: inputs.intentExecutor,
      abi: executorAbi,
      functionName: "executeWithSessionAndRefund",
      chain: null,
      args: [inputs.account, executions, inputs.nonce, gasRefund, signature],
    });
    console.log(`UNEXPECTED: submitted and did not revert: ${hash}`);
  } catch (err: any) {
    console.log(`reverted as expected. shortMessage: ${err?.shortMessage}`);
  }
}

async function main() {
  console.log(`fork-local factory ${FORK_FACTORY}, implementation ${FORK_IMPLEMENTATION} (record only; neither is called directly by this script)`);
  await runScenario("positive");
  await runDurationMismatchCheck();
  await runScenario("spendAboveCap");
}

main().catch((err) => {
  console.error("submit.mock-fork-check: failed", err);
  process.exitCode = 1;
});
