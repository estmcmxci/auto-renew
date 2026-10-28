// C8 probe. Read-only. Asks the LIVE validator whether a session may call
// setAddress, in two session shapes, and nothing else.
import { createPublicClient, http, encodeFunctionData, encodeAbiParameters, parseAbiParameters, keccak256, toHex } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildRenewSessionProof, encodeExecutions, operationHash, singleChainDigest,
  renewEnvelope, renewGasRefund, accountSignature, signRhinestoneMessage,
  NO_GAS_REFUND, type RenewSessionInputs, type Execution,
} from "./session.ts";
import { getNetwork } from "../config/networks.ts";

const net = getNetwork(11155111);
const A = net.ourStack!.DemoAccount as `0x${string}`;
const EXECUTOR = "0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF" as const;
// E9, 2026-10-27: was a placeholder (StandaloneHCAImplementation, not a
// resolver at all) per C8's own "WHAT I COULD NOT MEASURE" caveat. Now the
// real conforming resolver: a VerifiableFactory proxy of
// PERMITTED_RESOLVER_IMPL, deployed and set on autorenewdemo, with the HCA
// account granted ROLE_SET_ADDRESS via grantSetterRoles. See
// progress/evidence.md E9.
const RESOLVER_IMPL = "0xF26C66e16584BFfD88F72b45Bc9C1e4dFab3A549" as const;
const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_READ_RPC_URL!) });
const token = (net as any).tokens.USDC as `0x${string}`;
const label = net.demoName!.label;

const [accOwner, sessionNonce] = await client.readContract({
  address: A, abi:[{type:"function",name:"ownerAndSessionNonce",stateMutability:"view",inputs:[],
    outputs:[{type:"address"},{type:"uint96"}]}], functionName:"ownerAndSessionNonce",
}) as [`0x${string}`, bigint];
const block = await client.getBlock();
const sessionKey = privateKeyToAccount(process.env.SESSION_PRIVATE_KEY as `0x${string}`).address;

// A setAddress execution. dnsEncode("autorenewdemo.eth"), coinType 60.
function dnsEncode(name: string): `0x${string}` {
  const parts = name.split(".").map((l) => {
    const b = new TextEncoder().encode(l);
    return [b.length, ...b];
  }).flat();
  return ("0x" + [...parts, 0].map((n) => n.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}
const SET_ADDRESS_ABI = [{type:"function",name:"setAddress",stateMutability:"nonpayable",
  inputs:[{type:"bytes"},{type:"uint256"},{type:"bytes"}],outputs:[]}] as const;

function setAddressExecution(resolver: `0x${string}`): Execution {
  return { target: resolver, value: 0n, callData: encodeFunctionData({
    abi: SET_ADDRESS_ABI, functionName: "setAddress",
    args: [dnsEncode(`${label}.eth`), 60n, accOwner] }) };
}

async function ask(name: string, resolverInProof: `0x${string}`, executions: Execution[], nonce: bigint) {
  const base: RenewSessionInputs = {
    chainId: 11155111n, account: A, validator: net.ourStack!.HCAOwnerAndSessionValidator,
    intentExecutor: EXECUTOR, registrar: net.addresses.ETHRegistrar as `0x${string}`,
    paymentToken: token, nameOwner: accOwner, sessionKey, label, duration: 31557600n,
    renewPrice: 1n, maxRenewSpend: 1n, validUntil: block.timestamp + 86400n,
    sessionNonce, nonce, sessionToEnableIndex: 1, settlement: "none",
    refund: { token, maxExchangeRate: 5_000_000_000n, maxGasOverhead: 100_000n, maxAmount: 25_000_000n },
    sourceChain: { chainId: 84532n, sessionDigest: ("0x"+"11".repeat(32)) as `0x${string}` },
  };
  const { proof, permissionId } = await buildRenewSessionProof(base, process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  // Override the resolver AFTER the salt is built? No - the salt must include it.
  // Rebuild by hand: set resolver first, then recompute.
  proof.resolver = resolverInProof;
  const { sessionSalt, permissionId: pid, destinationSessionDigest, ownerAuthorizationDigest, signOwnerAuthorization } = await import("./session.ts");
  const salt = sessionSalt(proof);
  const id = pid(sessionKey, salt);
  proof.hashesAndChainIds = [
    base.sourceChain,
    { chainId: 11155111n, sessionDigest: destinationSessionDigest({ account: A, sessionKey, salt }) },
  ];
  const sig = await signOwnerAuthorization(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`,
    ownerAuthorizationDigest(proof.hashesAndChainIds));
  proof.ownerR = sig.r; proof.ownerS = sig.s; proof.ownerV = sig.v;

  const operationData = encodeExecutions(executions);
  const digest = singleChainDigest({ chainId: 11155111n, intentExecutor: EXECUTOR, account: A,
    nonce, operationHash: operationHash(executions), gasRefund: NO_GAS_REFUND });
  const envelope = renewEnvelope({ permissionId: id, proof, nonce, gasRefund: NO_GAS_REFUND,
    operationData, sessionSignature: await signRhinestoneMessage(process.env.SESSION_PRIVATE_KEY as `0x${string}`, digest) });

  // Ask the VALIDATOR directly. The account catches every revert and returns
  // 0xffffffff, which hides the rule that refused.
  try {
    const r = await client.call({ account: A, to: net.ourStack!.HCAOwnerAndSessionValidator as `0x${string}`,
      data: encodeFunctionData({
        abi:[{type:"function",name:"isValidSignatureWithSender",stateMutability:"view",
          inputs:[{type:"address"},{type:"bytes32"},{type:"bytes"}],outputs:[{type:"bytes4"}]}],
        functionName:"isValidSignatureWithSender", args:[EXECUTOR, digest, envelope] }) });
    console.log(`${name}: ACCEPTED ${r.data?.slice(0,10)}`);
  } catch (e:any) {
    const raw = JSON.stringify(e.cause?.data ?? e.data ?? e.details ?? "");
    const sels: Record<string,string> = {
      "0x8baa579f":"InvalidSigner", "0x3f7a2b1c":"?",
    };
    let m = (e.shortMessage ?? e.message ?? "").split("\n")[0];
    const errName = e.cause?.data?.errorName ?? e.cause?.errorName;
    console.log(`${name}: REFUSED  error=${errName ?? m}  raw=${raw.slice(0,90)}`);
  }
}

// Case A: our renew-shaped session, resolver = 0 in the proof, setAddress execution.
await ask("A  resolver=0, setAddress            ", "0x0000000000000000000000000000000000000000", [setAddressExecution(RESOLVER_IMPL as `0x${string}`)], 11n);
// Case B: same but the proof NAMES that resolver.
await ask("B  resolver=named, setAddress        ", RESOLVER_IMPL as `0x${string}`, [setAddressExecution(RESOLVER_IMPL as `0x${string}`)], 12n);
