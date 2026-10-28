// C7 eth_call simulation of the full submission path. Read-only.
import { createPublicClient, http, encodeFunctionData } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildRenewSessionPayload,
  executeSinglechainOpsCalldata,
  STANDALONE_INTENT_ABI,
  type RenewSessionInputs,
} from "/Users/oakgroup/auto-renew/operator/session.ts";
import { getNetwork } from "/Users/oakgroup/auto-renew/config/networks.ts";

const net = getNetwork(11155111);
const A = net.ourStack!.DemoAccount;
const EXECUTOR = "0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF" as const;
const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_READ_RPC_URL!) });

const label = net.demoName!.label;
const owner = net.demoName!.owner;
const registrar = net.addresses.ETHRegistrar;
const token = (net as any).tokens.USDC;
console.log("account  :", A);
console.log("label    :", label, "owner:", owner);
console.log("registrar:", registrar, "token:", token);

// live quote
const price = await client.readContract({
  address: registrar as `0x${string}`,
  abi: [{type:"function",name:"getRenewPrice",stateMutability:"view",
    inputs:[{type:"string"},{type:"uint64"},{type:"address"}],outputs:[{type:"uint256"}]}],
  functionName: "getRenewPrice",
  args: [label, 31557600n, token as `0x${string}`],
});
console.log("renewPrice:", price);

// session nonce the validator demands in the proof
const [accOwner, sessionNonce] = await client.readContract({
  address: A as `0x${string}`,
  abi: [{type:"function",name:"ownerAndSessionNonce",stateMutability:"view",inputs:[],
    outputs:[{type:"address"},{type:"uint96"}]}],
  functionName: "ownerAndSessionNonce",
}) as [string, bigint];
console.log("account owner:", accOwner, "sessionNonce:", sessionNonce);

const sessionKey = privateKeyToAccount(process.env.SESSION_PRIVATE_KEY as `0x${string}`).address;
const block = await client.getBlock();

const inputs: RenewSessionInputs = {
  chainId: 11155111n,
  account: A as `0x${string}`,
  validator: net.ourStack!.HCAOwnerAndSessionValidator,
  intentExecutor: EXECUTOR,
  registrar: registrar as `0x${string}`,
  paymentToken: token as `0x${string}`,
  nameOwner: accOwner as `0x${string}`,
  sessionKey,
  label,
  duration: 31557600n,
  renewPrice: price as bigint,
  maxRenewSpend: (price as bigint) + (price as bigint) / 10n,
  validUntil: block.timestamp + 86400n,
  sessionNonce,
  nonce: 1n,
  sessionToEnableIndex: 1,
  settlement: "none",
  refund: { token: token as `0x${string}`, maxExchangeRate: 5_000_000_000n, maxGasOverhead: 100_000n, maxAmount: 25_000_000n },
  sourceChain: { chainId: 84532n, sessionDigest: "0x" + "11".repeat(32) as `0x${string}` },
};

const payload = await buildRenewSessionPayload(inputs, {
  owner: process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`,
  session: process.env.SESSION_PRIVATE_KEY as `0x${string}`,
});
console.log("digest  :", payload.digest);
console.log("envelope bytes:", (payload.envelope.length-2)/2, "accountSignature bytes:", (payload.accountSignature.length-2)/2);

// 1. Does the ACCOUNT accept the signature? Direct ERC-1271 read, from the executor.
try {
  const r = await client.call({
    account: EXECUTOR,
    to: A as `0x${string}`,
    data: encodeFunctionData({
      abi:[{type:"function",name:"isValidSignature",stateMutability:"view",
        inputs:[{type:"bytes32"},{type:"bytes"}],outputs:[{type:"bytes4"}]}],
      functionName:"isValidSignature", args:[payload.digest, payload.accountSignature],
    }),
  });
  console.log("\n[1] account.isValidSignature ->", r.data, r.data==="0x1626ba7e00000000000000000000000000000000000000000000000000000000" ? "ERC-1271 MAGIC (accepted)" : "(0xffffffff = refused)");
} catch (e:any) { console.log("\n[1] isValidSignature REVERT:", e.shortMessage ?? e.message); }

// 2. Full path through the executor.
const calldata = executeSinglechainOpsCalldata({
  account: A as `0x${string}`, nonce: inputs.nonce,
  executorOpsData: payload.executorOpsData, accountSignature: payload.accountSignature,
});
console.log("[2] calldata bytes:", (calldata.length-2)/2);
try {
  const r = await client.call({ account: owner as `0x${string}`, to: EXECUTOR, data: calldata });
  console.log("[2] executeSinglechainOps SUCCESS ->", r.data);
} catch (e:any) {
  console.log("[2] executeSinglechainOps REVERT");
  console.log("    ", (e.shortMessage ?? e.message ?? "").split("\n")[0]);
  const m = JSON.stringify(e.details ?? e.cause?.details ?? "");
  if (m && m !== '""') console.log("    details:", m.slice(0,300));
}
