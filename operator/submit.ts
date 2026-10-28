// Submission path for the HCA renew session. ERD.md 7.2 step 3 ("Submit it
// with the session key"). operator/session.ts (C4/C7) builds the signed
// envelope; this file is the half that sends it. The boundary is
// session.ts's return value: this file never re-derives a digest or a
// signature, it only calls buildRenewSessionPayload and submits what comes
// back (`accountSignature`, `executorOpsData`).
//
// AGENTS.md rules 2 and 3 say which two keys this file may never load:
// the compromised 0x1C2F...fF21 and the estmcmxci.eth owner key. Neither
// SESSION_PRIVATE_KEY nor DEPLOYER_PRIVATE_KEY (this project's own
// deployer/owner key, generated fresh per .env.example) is either of those.
//
// TWO DISTINCT TRANSPORTS, not one. progress/contracts.md C6 found the live
// RHINESTONE_INTENT_EXECUTOR is a proxy to a real `IntentExecutor`
// (`executeSinglechainOps`/`executeSinglechainOpsWithGasRefund_ERC20`), not
// the local-only `MockRegistrationIntentExecutor`'s
// `executeWithSession`/`executeWithSessionAndRefund` (confirmed by an
// identical empty-data revert to a deliberately nonexistent selector,
// demo.md O1, 2026-10-27). The two ABIs below are for the two different
// contracts; never call one with the other's function names.
//
// `submitMockRenewal` is for the fork-local MockRegistrationIntentExecutor
// only (operator/submit.mock-fork-check.ts). `submitRealRenewal` is for the
// real, verified `IntentExecutor` (live Sepolia, per C6/C7) — per the
// manager's 2026-10-27 direction, the NO-REFUND entry point
// (`executeSinglechainOps`), not the ERC-20 refund variant, which needs an
// extra `Paymaster.callbackAllowMaxAmount` execution our three-call batch
// does not carry. STATUS per `progress/contracts.md` C7: gap 2 (the
// `executorOpsData` encoding) is BUILT but NOT PROVEN — the live simulation
// of `executeSinglechainOps` still reverts with empty data. Do not fire
// `submitRealRenewal` against live Sepolia until that is resolved.

import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { buildRenewSessionPayload, type RenewSessionInputs } from "./session.ts";

const MOCK_EXECUTOR_ABI = parseAbi([
  "function executeWithSessionAndRefund(address account, (address target, uint256 value, bytes callData)[] executions, uint256 nonce, (address token, uint256 exchangeRate, uint256 overhead) gasRefund, bytes signature) returns (bytes[])",
]);

// Literal JSON ABI, not a human-readable parseAbi string: fetched verbatim
// from the verified source on Sepolia Etherscan for
// 0x194DE341d4791e9b8922eE1bC018DFd1fD1b115A (the RHINESTONE_INTENT_EXECUTOR
// proxy's implementation), 2026-10-27, via api.etherscan.io/v2/api
// (getabi) -- not guessed, not the mock's shape, not hand-typed.
export const REAL_EXECUTOR_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          {
            components: [{ internalType: "bytes", name: "data", type: "bytes" }],
            internalType: "struct Types.Operation",
            name: "ops",
            type: "tuple",
          },
          { internalType: "bytes", name: "signature", type: "bytes" },
        ],
        internalType: "struct IStandaloneIntentExecutor.SingleChainOps",
        name: "signedOps",
        type: "tuple",
      },
    ],
    name: "executeSinglechainOps",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export interface SubmitRenewalArgs {
  rpcUrl: string;
  inputs: RenewSessionInputs;
  keys: { owner: Hex; session: Hex };
  /** Pays gas for the executor call. May be the session key itself. */
  senderPrivateKey: Hex;
}

/**
 * Fork-local only: MockRegistrationIntentExecutor's executeWithSessionAndRefund.
 * Builds the signed payload (session.ts) and submits it to
 * `args.inputs.intentExecutor`, which must be the MOCK, never the real one.
 */
export async function submitMockRenewal(args: SubmitRenewalArgs) {
  const payload = await buildRenewSessionPayload(args.inputs, args.keys);
  const sender = privateKeyToAccount(args.senderPrivateKey);
  const client = createWalletClient({
    account: sender,
    transport: http(args.rpcUrl),
  });

  const hash = await client.writeContract({
    address: args.inputs.intentExecutor,
    abi: MOCK_EXECUTOR_ABI,
    functionName: "executeWithSessionAndRefund",
    chain: null,
    args: [
      args.inputs.account,
      payload.executions,
      args.inputs.nonce,
      payload.gasRefund,
      payload.accountSignature,
    ],
  });

  return { hash, payload };
}

/**
 * The real, verified IntentExecutor's no-refund entry point. NOT YET FIRED
 * against live Sepolia: progress/contracts.md C7 found the ops-data
 * encoding still unproven (the live simulation reverts, empty data).
 * Callers must not treat a return from this function as proof the batch
 * executed -- check the receipt status, same as submitMockRenewal.
 */
export async function submitRealRenewal(args: SubmitRenewalArgs) {
  const payload = await buildRenewSessionPayload(
    { ...args.inputs, settlement: "none" },
    args.keys,
  );
  const sender = privateKeyToAccount(args.senderPrivateKey);
  const client = createWalletClient({
    account: sender,
    transport: http(args.rpcUrl),
  });

  const hash = await client.writeContract({
    address: args.inputs.intentExecutor,
    abi: REAL_EXECUTOR_ABI,
    functionName: "executeSinglechainOps",
    chain: null,
    args: [
      {
        account: args.inputs.account,
        nonce: args.inputs.nonce,
        ops: { data: payload.executorOpsData },
        signature: payload.accountSignature,
      },
    ],
  });

  return { hash, payload };
}
