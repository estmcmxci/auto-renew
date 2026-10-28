// Session payload construction for the HCA renew policy, ported from Solidity.
//
// progress/contracts.md C4. The project needs an ERC-4337 UserOperation
// against a Nexus-style account, not a plain signed transaction. This file is
// the half that builds the signature payload
// `HCAOwnerAndSessionValidator` accepts. It does NOT submit: `demo` owns the
// bundler path. The boundary is this file's return value.
//
// Every function here is pure. No RPC client, no key file, no clock, no
// environment read. Addresses and prices arrive as arguments, so the caller
// is the one that must take them from `config/networks.ts` and from the
// live oracle.
//
// THIS FILE MIRRORS SOLIDITY FIELD FOR FIELD. Each part names the file and
// the lines it came from, all at clone commit `3e54cdb8`:
//
//   contracts-v2/contracts/test/unit/hca/AutoRenewSessionFixture.sol
//   contracts-v2/contracts/test/unit/hca/AutoRenewPolicy.t.sol
//   contracts-v2/contracts/src/hca/HCAOwnerAndSessionValidator.sol
//   contracts-v2/contracts/src/hca/libraries/HCAOperationHashLib.sol
//
// If one side changes, the byte-equality test in
// `operator/session.vector.test.ts` fails. That test is the thing that stops
// the two from drifting. Do not weaken it.

import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  pad,
  parseAbiParameters,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";

////////////////////////////////////////////////////////////////////////////
// Constants
////////////////////////////////////////////////////////////////////////////

// AutoRenewSessionFixture.sol:22-38. Each constant is written in the SAME
// form the fixture uses: the two that are `keccak256("...")` expressions
// there are keccak expressions here over the identical string, and the eight
// that are literals there are literals here. Converting a literal into a
// recomputed hash, or the reverse, would hide exactly the kind of mismatch
// the byte-equality test exists to catch.

/** `keccak256("Ops(address to,uint256 value,bytes data)")`. Fixture line 22. */
export const OPS_TYPEHASH = keccak256(toHex("Ops(address to,uint256 value,bytes data)"));

/**
 * Fixture lines 23-24. The `vt` field is the ERC-7579 mode word, and `Ops[]`
 * is the execution array, so the nested type trails the primary one as
 * EIP-712 requires.
 */
export const OP_TYPEHASH = keccak256(
  toHex("Op(bytes32 vt,Ops[] ops)Ops(address to,uint256 value,bytes data)"),
);

/** Fixture line 25-26. */
export const SMART_SESSION_DOMAIN_TYPEHASH =
  "0xb03948446334eb9b2196d5eb166f69b9d49403eb4a12f36de8d3f9f3cb8e15c3" as Hex;

/** Fixture line 27-28. */
export const SMART_SESSION_NAME_HASH =
  "0x909aaff4c04d02fd420ef163a6d750c002b0a00dc41a031ba039e3fdb4732133" as Hex;

/** Fixture line 29-30. */
export const SMART_SESSION_VERSION_HASH =
  "0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6" as Hex;

/** Fixture line 31-32. */
export const SIGNED_SESSION_TYPEHASH =
  "0x984917e689987af96289e12c5f5e934fcdf1df4186108f69ff7e8c3df950ce33" as Hex;

/** Fixture line 33-34. */
export const CHAIN_SESSION_TYPEHASH =
  "0xabc350ff4773ba356e85e2d2ee58d7d7511767acdb108b59058f5b4a5afc074b" as Hex;

/** Fixture line 35-36. */
export const MULTI_CHAIN_SESSION_TYPEHASH =
  "0xb4323194e4ca3723804b96dc7a0960bde1afff2b080b8b288fdc264c82e21357" as Hex;

/** Fixture line 37-38. */
export const DEFAULT_SIGNED_PERMISSIONS_HASH =
  "0x242b79d1322c5e6b12b617584cc2d5766cf18be6feb6acfa469ccf289e11e504" as Hex;

/** Fixture line 40. */
export const SMART_SESSION_EMISSARY =
  "0xad568B3F825A8d5FFc06DD3253526B64D810Ae89" as Address;

/** Fixture line 41. */
export const OWNABLE_SESSION_VALIDATOR =
  "0x000000000013fdB5234E4E3162a810F54d9f7E98" as Address;

// HCAOwnerAndSessionValidator.sol:137-145. The IntentExecutor EIP-712
// typehashes, as literals in the source.

/** Validator line 136-137. */
export const SINGLE_CHAIN_OPS_TYPEHASH =
  "0xbae11135c33effc421d699bbb53d9926a005ed0f2f5eb672c62cbfa943807291" as Hex;

/** Validator line 140-141. */
export const GAS_REFUND_TYPEHASH =
  "0x0bf04d9dcc5e703a75ba16d19c00f9d87fa30b9a815627102c15624d338eb094" as Hex;

/** Validator line 144-145. */
export const NO_GAS_REFUND_HASH =
  "0x44db4de84d423abe696e354fc99de162153ee2f8985ab84305061247a78a3be4" as Hex;

/**
 * `keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")`.
 * Validator line 124-127.
 */
export const EIP712_DOMAIN_TYPEHASH = keccak256(
  toHex(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
  ),
);

/** `keccak256("IntentExecutor")`. Validator line 130. */
export const INTENT_EXECUTOR_NAME_HASH = keccak256(toHex("IntentExecutor"));

/** `keccak256("v0.0.1")`. Validator line 133. */
export const INTENT_EXECUTOR_VERSION_HASH = keccak256(toHex("v0.0.1"));

/**
 * `bytes32(uint256(0x0201) << 240)`, HCAOperationHashLib.sol:34. Only the top
 * two bytes reach the wire; `_encodeExecutions` takes `bytes2` of it
 * (fixture line 69) and `_decodeOperation` rebuilds the word from those two
 * bytes (fixture lines 96-100), which is why the operation hash sees
 * `0x0201` followed by thirty zero bytes and not the other way round.
 */
export const ERC7579_ERC1271_MODE =
  "0x0201000000000000000000000000000000000000000000000000000000000000" as Hex;

/** The 2-byte prefix of the mode, as it appears in the operation data. */
const ERC7579_ERC1271_MODE_PREFIX = "0x0201" as Hex;

/**
 * The same-chain envelope selector. `bytes1(uint8(5))`, AutoRenewPolicy.t.sol
 * line 338. Mode 4 is the permit2 route; this project only uses 5.
 */
const ENVELOPE_MODE_SAME_CHAIN_WITH_REFUND = "0x05" as Hex;

/**
 * One year in seconds; AutoRenewPolicy.t.sol line 95.
 * A POLICY number, not a protocol one: `MIN_RENEW_DURATION` is 1 second on
 * both the registrar and the renewer, so nothing on chain bounds this.
 */
export const RENEWAL_DURATION = 31557600n;

////////////////////////////////////////////////////////////////////////////
// Types
////////////////////////////////////////////////////////////////////////////

/**
 * AutoRenewSessionFixture.sol:47-64, the 15-field proof struct, in the same
 * order. The last three before `hashesAndChainIds` are the fields R3 added;
 * they are what take the packed header from 110 bytes to 150.
 */
export interface SessionEnableProof {
  sessionKey: Address;
  /** uint48 */
  validUntil: bigint;
  /** uint96 */
  sessionNonce: bigint;
  resolver: Address;
  refundToken: Address;
  /** uint96 */
  maxRefundExchangeRate: bigint;
  /** uint48 */
  maxRefundGasOverhead: bigint;
  /** uint96 */
  maxRefundAmount: bigint;
  /** uint8 */
  sessionToEnableIndex: number;
  renewPaymentToken: Address;
  /** uint64 */
  renewalDuration: bigint;
  /** uint96 */
  maxRenewSpend: bigint;
  hashesAndChainIds: HashAndChainId[];
  ownerR: Hex;
  ownerS: Hex;
  /** uint8, 27 or 28. Raw, NOT the +4 the session signature carries. */
  ownerV: number;
}

/** HCASmartSessionLib.sol:24-27. */
export interface HashAndChainId {
  /** uint64 */
  chainId: bigint;
  sessionDigest: Hex;
}

/** HCAOwnerAndSessionValidator.sol:46-50. Both amounts are uint256 there. */
export interface GasRefund {
  token: Address;
  exchangeRate: bigint;
  overhead: bigint;
}

/** nexus/types/DataTypes.sol. `value` is always 0 on this route. */
export interface Execution {
  target: Address;
  value: bigint;
  callData: Hex;
}

/**
 * Everything the construction needs that this file must not fetch itself.
 * The caller reads the four addresses from `config/networks.ts` and the
 * price from the live oracle, so no address is ever a literal here.
 */
export interface RenewSessionInputs {
  /** `block.chainid` of the chain the renewal lands on. */
  chainId: bigint;
  /** The HCA account instance. `ourStack.DemoAccount` on Sepolia. */
  account: Address;
  /** `ourStack.HCAOwnerAndSessionValidator`. */
  validator: Address;
  /** The validator's `INTENT_EXECUTOR` immutable, read from the deployment. */
  intentExecutor: Address;
  /** The v2 renew target. `addresses.ETHRegistrar`. */
  registrar: Address;
  /** `addresses.MockUSDC` on Sepolia, the renewal payment token. */
  paymentToken: Address;
  /** The name's registry owner. Funds are pulled FROM this address. */
  nameOwner: Address;
  /** The session signer's address, derived from the session key. */
  sessionKey: Address;
  /** The label only, e.g. "autorenewdemo". Not the full name. */
  label: string;
  /** Seconds. One year per D7 unless a caller overrides it. */
  duration: bigint;
  /**
   * `getRenewPrice(label, duration, paymentToken)` from the live oracle, in
   * the token's smallest unit. Both money legs carry this EXACT number;
   * `_checkRenewBatch` refuses anything else.
   */
  renewPrice: bigint;
  /**
   * The per-session spend cap. D7 sets it from the live quote plus headroom
   * for oracle drift; the fixture uses `renewPrice + renewPrice / 10`
   * (AutoRenewPolicy.t.sol line 254).
   */
  maxRenewSpend: bigint;
  /** uint48. The session's expiry. */
  validUntil: bigint;
  /** uint96. AutoRenewPolicy.t.sol line 243 uses 0. */
  sessionNonce: bigint;
  /** The operation nonce. One per batch. */
  nonce: bigint;
  /**
   * The refund configuration. The validator refuses an all-zero refund on
   * this route, so these cannot be left at zero (AutoRenewPolicy.t.sol
   * lines 244-248).
   */
  refund: {
    token: Address;
    /** uint96 */
    maxExchangeRate: bigint;
    /** uint48 */
    maxGasOverhead: bigint;
    /** uint96 */
    maxAmount: bigint;
  };
  /** uint8. AutoRenewPolicy.t.sol line 249 uses 1. */
  sessionToEnableIndex: number;
  /**
   * Which settlement the batch is built for. Default `"refund"`, which is
   * what the C4 vector and the nine-case matrix use.
   *
   * `"none"` builds the NO-REFUND shape: the envelope still carries the
   * proof's non-zero refund MAXIMA, because
   * `HCAOwnerAndSessionValidator.sol` lines 396-404 refuse a proof with a
   * zero `refundToken`, `maxRefundExchangeRate` or `maxRefundAmount`, but
   * the ACTUAL `GasRefund` in the envelope is all zero. `_checkGasRefund`
   * (lines 1141-1146) allows exactly that, and `_singleChainDigest` then
   * takes the `NO_GAS_REFUND_HASH` branch, which is the same
   * `NO_GASREFUND` constant the executor's `executeSinglechainOps` passes.
   * That is the path C6 recommends: it needs no `Paymaster`
   * `callbackAllowMaxAmount` execution, which our three-execution batch has
   * no room for.
   */
  settlement?: "refund" | "none";
  /**
   * The source-chain half of the two-entry multi-chain authorization. The
   * fixture uses chain 84532 with `keccak256("source session")`
   * (AutoRenewPolicy.t.sol lines 290-292). It is not the chain the renewal
   * lands on; it only has to be present and signed.
   */
  sourceChain: HashAndChainId;
}

/** What this file hands to `demo`. */
export interface RenewSessionPayload {
  /** The three executions, in D6 order: pull, approve, renew. */
  executions: Execution[];
  /** `_encodeExecutions` output. Goes inside the envelope. */
  operationData: Hex;
  /** The permissionId the validator derives from the salt. */
  permissionId: Hex;
  /** The ERC-1271 hash the account is asked to validate. */
  digest: Hex;
  /** The full signature payload, BARE. See `accountSignature` before sending. */
  envelope: Hex;
  /**
   * What the ACCOUNT must receive: 20 zero bytes, then the envelope.
   * This, not `envelope`, is what goes in `SingleChainOps.signature`.
   */
  accountSignature: Hex;
  /**
   * `Types.Operation.data` as the EXECUTOR's calldata wants it. A different
   * encoding of the same executions from `operationData`; see
   * `encodeExecutorOpsData`.
   */
  executorOpsData: Hex;
  /** The proof, kept so a caller can assert a field without re-deriving. */
  proof: SessionEnableProof;
  /** The refund struct the digest was built over. */
  gasRefund: GasRefund;
}

////////////////////////////////////////////////////////////////////////////
// Packing helpers
////////////////////////////////////////////////////////////////////////////

/**
 * `abi.encodePacked` for one unsigned integer of a named bit width. Solidity
 * packs a `uintN` into exactly N/8 bytes, which is the whole reason the
 * header is 150 bytes and not 12 words.
 */
function packUint(value: bigint, bits: number): Hex {
  if (value < 0n || value >= 1n << BigInt(bits)) {
    throw new Error(`uint${bits} out of range: ${value}`);
  }
  return pad(toHex(value), { size: bits / 8 });
}

/** `abi.encode` of a single uint256-shaped word. */
function word(value: bigint | Hex | Address): Hex {
  return typeof value === "bigint"
    ? pad(toHex(value), { size: 32 })
    : pad(value, { size: 32 });
}

/**
 * An address as `abi.encodePacked` writes it: twenty bytes, lower case.
 *
 * Solidity has no checksum casing, so a raw-packed address is twenty bytes
 * and nothing else. viem keeps whatever casing the caller's string had, and
 * `concatHex` carries it through, so a checksummed input produces a hex
 * string that is byte-identical but compares unequal. Every raw-packed
 * address goes through here. The ABI encoder does not need it, because it
 * left-pads into a word of its own.
 */
function packAddress(value: Address): Hex {
  return value.toLowerCase() as Hex;
}

////////////////////////////////////////////////////////////////////////////
// The three executions
////////////////////////////////////////////////////////////////////////////

const ERC20_ABI = [
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const ETH_RENEWER_ABI = [
  {
    type: "function",
    name: "renew",
    inputs: [
      {
        name: "rd",
        type: "tuple",
        components: [
          { name: "label", type: "string" },
          { name: "duration", type: "uint64" },
          { name: "referrer", type: "bytes32" },
        ],
      },
      { name: "paymentToken", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * The three executions D6 requires, in order: pull from the owner, approve
 * the registrar, renew. Ported from `_renewExecutionsFor`,
 * AutoRenewPolicy.t.sol lines 360-395.
 *
 * The order is load bearing. `_checkRenewBatch` requires the approve
 * spender to equal the renew target and both amounts to equal the quoted
 * price, and it refuses a stray approve or pull when no renew is present.
 */
export function renewExecutions(inputs: {
  paymentToken: Address;
  registrar: Address;
  nameOwner: Address;
  account: Address;
  label: string;
  duration: bigint;
  renewPrice: bigint;
}): Execution[] {
  return [
    // AutoRenewPolicy.t.sol lines 371-378. Pull FROM the name owner INTO the
    // HCA. The owner's ERC-20 allowance is the period cap, per D6; this file
    // adds no accounting of its own.
    {
      target: inputs.paymentToken,
      value: 0n,
      callData: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transferFrom",
        args: [inputs.nameOwner, inputs.account, inputs.renewPrice],
      }),
    },
    // AutoRenewPolicy.t.sol lines 379-383.
    {
      target: inputs.paymentToken,
      value: 0n,
      callData: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [inputs.registrar, inputs.renewPrice],
      }),
    },
    // AutoRenewPolicy.t.sol lines 384-392. The target is `ETHRegistrar`, the
    // v2 path, NOT `ETHRenewerV1`: T9 proves the v1 renewer refuses a v2
    // name with the registrar's `NameNotRenewable`.
    {
      target: inputs.registrar,
      value: 0n,
      callData: encodeFunctionData({
        abi: ETH_RENEWER_ABI,
        functionName: "renew",
        args: [
          { label: inputs.label, duration: inputs.duration, referrer: pad("0x00", { size: 32 }) },
          inputs.paymentToken,
        ],
      }),
    },
  ];
}

////////////////////////////////////////////////////////////////////////////
// Operation encoding and hashing
////////////////////////////////////////////////////////////////////////////

/**
 * `_encodeExecutions`, AutoRenewSessionFixture.sol lines 66-86.
 *
 * Layout: the 2-byte mode prefix, a uint8 count, then per execution the
 * 20-byte target, a uint24 call-data length and the call data itself.
 */
export function encodeExecutions(executions: Execution[]): Hex {
  const parts: Hex[] = [ERC7579_ERC1271_MODE_PREFIX, packUint(BigInt(executions.length), 8)];
  for (const execution of executions) {
    // The fixture asserts both of these (lines 74-75) rather than encoding a
    // value it cannot represent. Same here, loudly.
    if (execution.value !== 0n) {
      throw new Error("this route carries no value");
    }
    const callDataBytes = BigInt((execution.callData.length - 2) / 2);
    if (callDataBytes > 0xffffffn) {
      throw new Error("call data longer than uint24");
    }
    parts.push(packAddress(execution.target), packUint(callDataBytes, 24), execution.callData);
  }
  return concatHex(parts);
}

/**
 * `_operationHash`, AutoRenewSessionFixture.sol lines 132-147.
 *
 * Takes the executions directly instead of decoding them back out of the
 * packed bytes. The Solidity helper decodes because it only has the packed
 * form to hand; the round trip is identity, and `_decodeOperation`'s cursor
 * checks (fixture lines 104-129) are a decoder's job, not an encoder's.
 */
export function operationHash(executions: Execution[]): Hex {
  const executionHashes = executions.map((execution) =>
    keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, address, uint256, bytes32"), [
        OPS_TYPEHASH,
        execution.target,
        execution.value,
        keccak256(execution.callData),
      ]),
    ),
  );
  return keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, bytes32, bytes32"), [
      OP_TYPEHASH,
      ERC7579_ERC1271_MODE,
      keccak256(concatHex(executionHashes)),
    ]),
  );
}

/**
 * `_singleChainDigest`, HCAOwnerAndSessionValidator.sol lines 591-628. This
 * is the hash the account validates, and `singleChainDigestWithRefundHarness`
 * (HCAOwnerAndSessionValidator.t.sol lines 1106-1117) is only that function
 * plus a decode, which is why the test's digest and this one agree.
 *
 * The domain binds `chainId` and the validator's `INTENT_EXECUTOR`
 * immutable, not the validator's own address. A digest built with the wrong
 * executor is refused with `InvalidSessionData`.
 */
export function singleChainDigest(args: {
  chainId: bigint;
  intentExecutor: Address;
  account: Address;
  nonce: bigint;
  operationHash: Hex;
  gasRefund: GasRefund;
}): Hex {
  // Validator lines 601-612. The all-zero refund takes the constant instead
  // of a hash of zeros.
  const gasRefundHash =
    args.gasRefund.token === "0x0000000000000000000000000000000000000000" &&
    args.gasRefund.exchangeRate === 0n &&
    args.gasRefund.overhead === 0n
      ? NO_GAS_REFUND_HASH
      : keccak256(
          encodeAbiParameters(parseAbiParameters("bytes32, address, uint256, uint256"), [
            GAS_REFUND_TYPEHASH,
            args.gasRefund.token,
            args.gasRefund.exchangeRate,
            args.gasRefund.overhead,
          ]),
        );
  // Validator lines 613-616.
  const structHash = keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, address, uint256, bytes32, bytes32"), [
      SINGLE_CHAIN_OPS_TYPEHASH,
      args.account,
      args.nonce,
      args.operationHash,
      gasRefundHash,
    ]),
  );
  // Validator lines 617-626.
  const domainSeparator = keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, bytes32, bytes32, uint256, address"), [
      EIP712_DOMAIN_TYPEHASH,
      INTENT_EXECUTOR_NAME_HASH,
      INTENT_EXECUTOR_VERSION_HASH,
      args.chainId,
      args.intentExecutor,
    ]),
  );
  // Validator line 627, `MessageHashUtils.toTypedDataHash`.
  return keccak256(concatHex(["0x1901", domainSeparator, structHash]));
}

////////////////////////////////////////////////////////////////////////////
// The owner-signed session authorization
////////////////////////////////////////////////////////////////////////////

/**
 * The salt. SEVEN fields, the same seven the pristine validator hashes.
 *
 * All three renew fields are still committed, but they ride in spare high
 * bits of words 1 and 6 instead of taking three words of their own. R3's
 * third pass found that leaving them out of the hash entirely makes the
 * derived permissionId diverge from the validator's and the proof is
 * refused with `InvalidSessionData`. That cost a whole beat in Solidity.
 * The same mistake in TypeScript would look identical, so the field list
 * below is deliberately spelled out rather than built from the proof object
 * by key order.
 *
 * The packing is what keeps a pre-existing session valid: a session that
 * does not enable auto-renew holds zero in all three caps, zero changes no
 * bit, so this returns the salt the pristine validator returned. See C11.
 */
export function sessionSalt(proof: SessionEnableProof): Hex {
  // Word 1 carries sessionNonce in bits 0-95 and renewPaymentToken in bits 96-255.
  // Word 6 carries maxRefundGasOverhead in bits 0-47, renewalDuration in bits 48-111
  // and maxRenewSpend in bits 112-207. No range overlaps, so the packing is lossless.
  const word1 =
    proof.sessionNonce | (BigInt(proof.renewPaymentToken) << 96n);
  const word6 =
    proof.maxRefundGasOverhead |
    (proof.renewalDuration << 48n) |
    (proof.maxRenewSpend << 112n);
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("uint256, uint48, address, address, uint96, uint256, uint96"),
      [
        word1,
        // viem represents uint8 through uint48 as `number`, not `bigint`.
        // The encoder accepts either at runtime, so this conversion changes no
        // byte; it stops `tsc` complaining about the field.
        Number(proof.validUntil),
        proof.resolver,
        proof.refundToken,
        proof.maxRefundExchangeRate,
        word6,
        proof.maxRefundAmount,
      ],
    ),
  );
}

/**
 * The OwnableValidator init data for a single session owner.
 * AutoRenewPolicy.t.sol lines 254-257: `abi.encode(uint256(1), sessionOwners)`,
 * a threshold of one and a one-entry owner array.
 */
export function validatorInitData(sessionKey: Address): Hex {
  return encodeAbiParameters(parseAbiParameters("uint256, address[]"), [1n, [sessionKey]]);
}

/**
 * `permissionId`, AutoRenewPolicy.t.sol line 273. The validator derives the
 * same value, so this is the join between the two sides.
 */
export function permissionId(sessionKey: Address, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("address, bytes, bytes32"), [
      OWNABLE_SESSION_VALIDATOR,
      validatorInitData(sessionKey),
      salt,
    ]),
  );
}

/**
 * The destination-chain session digest, AutoRenewPolicy.t.sol lines 274-288.
 * Nine static words. `type(uint256).max` is the permission's own validUntil
 * inside Smart Sessions; the session's real expiry is `proof.validUntil`,
 * which the validator reads from the packed header.
 */
export function destinationSessionDigest(args: {
  account: Address;
  sessionKey: Address;
  salt: Hex;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32, address, uint256, uint256, bytes32, bytes32, address, bytes32, address",
      ),
      [
        SIGNED_SESSION_TYPEHASH,
        args.account,
        (1n << 256n) - 1n,
        0n,
        DEFAULT_SIGNED_PERMISSIONS_HASH,
        args.salt,
        OWNABLE_SESSION_VALIDATOR,
        keccak256(validatorInitData(args.sessionKey)),
        SMART_SESSION_EMISSARY,
      ],
    ),
  );
}

/**
 * The digest the OWNER signs, AutoRenewPolicy.t.sol lines 295-317. A
 * Smart Sessions multi-chain EIP-712 hash over both chain entries.
 *
 * Note the domain: two fields only, no chainId and no verifyingContract
 * (fixture line 25-26 pairs with lines 309-315 of the test). That is Smart
 * Sessions' own domain, not the IntentExecutor one used for the operation
 * digest. Mixing the two is the other way to get `InvalidSessionData`.
 */
export function ownerAuthorizationDigest(hashesAndChainIds: HashAndChainId[]): Hex {
  const chainSessionHashes = hashesAndChainIds.map((item) =>
    keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, uint64, bytes32"), [
        CHAIN_SESSION_TYPEHASH,
        item.chainId,
        item.sessionDigest,
      ]),
    ),
  );
  const structHash = keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [
      MULTI_CHAIN_SESSION_TYPEHASH,
      keccak256(concatHex(chainSessionHashes)),
    ]),
  );
  const domainSeparator = keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, bytes32, bytes32"), [
      SMART_SESSION_DOMAIN_TYPEHASH,
      SMART_SESSION_NAME_HASH,
      SMART_SESSION_VERSION_HASH,
    ]),
  );
  return keccak256(concatHex(["0x1901", domainSeparator, structHash]));
}

////////////////////////////////////////////////////////////////////////////
// Signing
////////////////////////////////////////////////////////////////////////////

/**
 * `_signRhinestoneMessage`, AutoRenewSessionFixture.sol lines 160-169.
 *
 * Two things differ from a plain EIP-712 signature, and both matter:
 * the digest is wrapped in the EIP-191 personal-sign prefix before signing,
 * and `v` is returned PLUS FOUR. Rhinestone uses the offset to mark the
 * personal-sign variant. A signature without it recovers a different
 * address and the validator answers `InvalidSigner`.
 */
export async function signRhinestoneMessage(privateKey: Hex, digest: Hex): Promise<Hex> {
  const personalDigest = keccak256(
    concatHex([toHex("\x19Ethereum Signed Message:\n32"), digest]),
  );
  const signature = await sign({ hash: personalDigest, privateKey });
  const v = signature.v ?? (signature.yParity === 0 ? 27n : 28n);
  return concatHex([signature.r, signature.s, packUint(v + 4n, 8)]);
}

/**
 * The owner's signature over `ownerAuthorizationDigest`. RAW, unlike the
 * session signature above: `vm.sign` on fixture line 316 of
 * AutoRenewPolicy.t.sol applies no prefix and no offset. Returned split,
 * because `_packProof` packs r, s and v separately.
 */
export async function signOwnerAuthorization(
  privateKey: Hex,
  digest: Hex,
): Promise<{ r: Hex; s: Hex; v: number }> {
  const signature = await sign({ hash: digest, privateKey });
  const v = signature.v ?? (signature.yParity === 0 ? 27n : 28n);
  return { r: signature.r, s: signature.s, v: Number(v) };
}

////////////////////////////////////////////////////////////////////////////
// The packed proof and the envelope
////////////////////////////////////////////////////////////////////////////

/**
 * `_packProof`, AutoRenewSessionFixture.sol lines 171-196.
 *
 * The header is 150 bytes and the validator's
 * `_SESSION_PROOF_HEADER_LENGTH` must agree:
 *
 *   sessionKey            address  20
 *   validUntil            uint48    6
 *   sessionNonce          uint96   12
 *   resolver              address  20
 *   refundToken           address  20
 *   maxRefundExchangeRate uint96   12
 *   maxRefundGasOverhead  uint48    6
 *   maxRefundAmount       uint96   12
 *   sessionToEnableIndex  uint8     1
 *   renewPaymentToken     address  20   <- R3
 *   renewalDuration       uint64    8   <- R3
 *   maxRenewSpend         uint96   12   <- R3
 *   hashesAndChainIds.len uint8     1
 *                                 ---
 *                                 150
 *
 * Then 40 bytes per chain entry (uint64 chainId, bytes32 digest), then the
 * owner's 65-byte signature. The three R3 fields took the header from 110 to
 * 150 and that change broke sixteen existing tests until the test's own salt
 * was widened to match; the check in `operator/session.vector.test.ts` is
 * what keeps this table honest.
 */
export function packProof(proof: SessionEnableProof): Hex {
  const header = concatHex([
    packAddress(proof.sessionKey),
    packUint(proof.validUntil, 48),
    packUint(proof.sessionNonce, 96),
    packAddress(proof.resolver),
    packAddress(proof.refundToken),
    packUint(proof.maxRefundExchangeRate, 96),
    packUint(proof.maxRefundGasOverhead, 48),
    packUint(proof.maxRefundAmount, 96),
    packUint(BigInt(proof.sessionToEnableIndex), 8),
    packAddress(proof.renewPaymentToken),
    packUint(proof.renewalDuration, 64),
    packUint(proof.maxRenewSpend, 96),
    packUint(BigInt(proof.hashesAndChainIds.length), 8),
  ]);
  const entries = proof.hashesAndChainIds.map((item) =>
    concatHex([packUint(item.chainId, 64), item.sessionDigest]),
  );
  return concatHex([
    header,
    ...entries,
    proof.ownerR,
    proof.ownerS,
    packUint(BigInt(proof.ownerV), 8),
  ]);
}

/** The header length this port writes. Asserted by the vector test. */
export const SESSION_PROOF_HEADER_LENGTH = 150;

/**
 * `_renewEnvelope`, AutoRenewPolicy.t.sol lines 324-348. Mode 5, the
 * same-chain route with a refund.
 *
 * The three refund fields after the nonce are NOT the GasRefund struct as
 * the digest sees it. The digest hashes two uint256s; the envelope packs the
 * exchange rate as a uint96 and splits `overhead` into its high 128 bits as
 * a uint96 and its low 128 as a uint48 (test lines 342-344). The validator
 * reassembles them. Build `overhead` with `renewGasRefund` below rather
 * than by hand.
 */
export function renewEnvelope(args: {
  permissionId: Hex;
  proof: SessionEnableProof;
  nonce: bigint;
  gasRefund: GasRefund;
  operationData: Hex;
  sessionSignature: Hex;
}): Hex {
  return concatHex([
    ENVELOPE_MODE_SAME_CHAIN_WITH_REFUND,
    args.permissionId,
    packProof(args.proof),
    word(args.nonce),
    packAddress(args.gasRefund.token),
    packUint(args.gasRefund.exchangeRate, 96),
    packUint(args.gasRefund.overhead >> 128n, 96),
    packUint(args.gasRefund.overhead & ((1n << 128n) - 1n), 48),
    args.operationData,
    args.sessionSignature,
  ]);
}

/**
 * The 20 zero bytes the ACCOUNT requires in front of the envelope.
 *
 * `StandaloneSingleOwnerHCA.isValidSignature` (clone `3e54cdb8`, lines
 * 265-290) reads `address(bytes20(signature[:20]))` and reverts
 * `ValidatorNotInstalled` unless it is the zero address; only then does it
 * forward `signature[20:]` to its IMMUTABLE default validator. The Rhinestone
 * SDK does the same thing at `dist/src/execution/utils.js:1104`, where
 * `packStandaloneHcaFixedSessionSignature` returns
 * `concat([zeroAddress, encodePacked(...)])`.
 *
 * Kept as its own export rather than folded into `renewEnvelope`, because the
 * C4 byte-equality vector asserts the BARE envelope against the Solidity
 * fixture, and the Solidity tests call the validator through a mock that takes
 * the validator as a parameter instead of reading a prefix. Both forms are
 * asserted in `operator/session.vector.test.ts`.
 */
export const ACCOUNT_SIGNATURE_PREFIX = ("0x" + "00".repeat(20)) as Hex;

/**
 * The envelope as the deployed account must receive it.
 *
 * Send THIS in `SingleChainOps.signature`, never the bare envelope. A bare
 * envelope reverts `ValidatorNotInstalled`, because its first 20 bytes are
 * the session key, which is not the zero address.
 */
export function accountSignature(envelope: Hex): Hex {
  return concatHex([ACCOUNT_SIGNATURE_PREFIX, envelope]);
}

/**
 * `Types.Operation.data` in the form the EXECUTOR's CALLDATA uses.
 *
 * There are TWO encodings of the same executions on this path and conflating
 * them is the trap:
 *
 *   - Inside the SIGNATURE, the compact form from `encodeExecutions` above:
 *     `vt[0:2] || uint8(count) || [to(20) || uint24(len) || data]...`. Our
 *     validator decodes this. The SDK builds the identical bytes in
 *     `packIntentOperation`, `dist/src/execution/utils.js:741-766`.
 *   - In the executor's CALLDATA, this form:
 *     `0x02 || 0x01 || abi.encode(Execution[])`. The verified
 *     `SmartExecutionLib.encode` builds it that way, and `safeToERC7579`
 *     decodes it with `decodeBatchUnchecked`, which expects ABI encoding, not
 *     the compact packing.
 *
 * Byte 0 is the execution type and byte 1 the signature mode, from the
 * verified `SmartExecutionLib`: `enum Type { Eip712Hash, Calldata, ERC7579,
 * MultiCall }` makes ERC7579 = 2, and `enum SigMode { EMISSARY, ERC1271, ... }`
 * makes ERC1271 = 1. So `0x0201` is literally "ERC-7579 executions,
 * ERC-1271 signature", which is what our validator's
 * `ERC7579_ERC1271_MODE` names.
 *
 * The two encodings must hash to the SAME `Op(bytes32 vt,Ops[] ops)` value,
 * because the executor hashes its calldata copy and our validator hashes the
 * signature copy, and `_singleChainDigest` requires them equal. They can,
 * because both hash the DECODED executions and both use the same typehashes;
 * this was checked against the verified executor, see
 * `progress/contracts.md` C7.
 */
export function encodeExecutorOpsData(executions: Execution[]): Hex {
  for (const execution of executions) {
    if (execution.value !== 0n) {
      throw new Error("this route carries no value");
    }
  }
  return concatHex([
    ERC7579_ERC1271_MODE_PREFIX,
    encodeAbiParameters(
      [
        {
          type: "tuple[]",
          components: [
            { name: "target", type: "address" },
            { name: "value", type: "uint256" },
            { name: "callData", type: "bytes" },
          ],
        },
      ],
      [executions],
    ),
  ]);
}

/** An all-zero `GasRefund`. The no-refund shape C6 recommends. */
export const NO_GAS_REFUND: GasRefund = {
  token: "0x0000000000000000000000000000000000000000",
  exchangeRate: 0n,
  overhead: 0n,
};

/**
 * The calldata for the executor's NO-REFUND entry point,
 * `executeSinglechainOps(SingleChainOps)`.
 *
 * `SingleChainOps` is `{ address account; uint256 nonce; Types.Operation ops;
 * bytes signature; }` from the verified
 * `src/executor/interfaces/IStandaloneIntent.sol` lines 56-65, and
 * `Types.Operation` is a single `bytes data` field
 * (`src/types/OrderTypes.sol`). The nonce is a plain struct field, read by
 * `hashAndDecode` (`EIP712Lib.sol` lines 196-206); it is NOT carried inside
 * the ops bytes.
 *
 * Pure. It returns calldata; it does not send it. `demo` sends it.
 */
export function executeSinglechainOpsCalldata(args: {
  account: Address;
  nonce: bigint;
  executorOpsData: Hex;
  accountSignature: Hex;
}): Hex {
  return encodeFunctionData({
    abi: STANDALONE_INTENT_ABI,
    functionName: "executeSinglechainOps",
    args: [
      {
        account: args.account,
        nonce: args.nonce,
        ops: { data: args.executorOpsData },
        signature: args.accountSignature,
      },
    ],
  });
}

/**
 * The one executor function this project calls, transcribed from the verified
 * implementation at `0x194DE341d4791e9b8922eE1bC018DFd1fD1b115A`. Declared
 * `external nonReentrant` with no access control, so any EOA may call it.
 */
export const STANDALONE_INTENT_ABI = [
  {
    type: "function",
    name: "executeSinglechainOps",
    inputs: [
      {
        name: "signedOps",
        type: "tuple",
        components: [
          { name: "account", type: "address" },
          { name: "nonce", type: "uint256" },
          {
            name: "ops",
            type: "tuple",
            components: [{ name: "data", type: "bytes" }],
          },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "account", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * The GasRefund the digest is built over, from the proof's own refund
 * fields. AutoRenewPolicy.t.sol lines 400-406: the amount goes in the HIGH
 * 128 bits of `overhead` and the gas overhead in the low 128. Packing them
 * the other way round produces a digest the account refuses.
 */
export function renewGasRefund(proof: SessionEnableProof): GasRefund {
  return {
    token: proof.refundToken,
    exchangeRate: proof.maxRefundExchangeRate,
    overhead: (proof.maxRefundAmount << 128n) | proof.maxRefundGasOverhead,
  };
}

////////////////////////////////////////////////////////////////////////////
// The whole construction
////////////////////////////////////////////////////////////////////////////

/**
 * Builds the owner-signed session authorization. Ported from
 * `_renewEnableProof`, AutoRenewPolicy.t.sol lines 235-318.
 *
 * `resolver` is left at the zero address on purpose: a renewal touches no
 * resolver, and that is the one field this proof sets differently from the
 * register-path proof in `HCAOwnerAndSessionValidator.t.sol`.
 */
export async function buildRenewSessionProof(
  inputs: RenewSessionInputs,
  ownerPrivateKey: Hex,
): Promise<{ proof: SessionEnableProof; permissionId: Hex; salt: Hex }> {
  const proof: SessionEnableProof = {
    sessionKey: inputs.sessionKey,
    validUntil: inputs.validUntil,
    sessionNonce: inputs.sessionNonce,
    resolver: "0x0000000000000000000000000000000000000000",
    refundToken: inputs.refund.token,
    maxRefundExchangeRate: inputs.refund.maxExchangeRate,
    maxRefundGasOverhead: inputs.refund.maxGasOverhead,
    maxRefundAmount: inputs.refund.maxAmount,
    sessionToEnableIndex: inputs.sessionToEnableIndex,
    renewPaymentToken: inputs.paymentToken,
    renewalDuration: inputs.duration,
    maxRenewSpend: inputs.maxRenewSpend,
    hashesAndChainIds: [],
    ownerR: pad("0x00", { size: 32 }),
    ownerS: pad("0x00", { size: 32 }),
    ownerV: 0,
  };

  const salt = sessionSalt(proof);
  const id = permissionId(inputs.sessionKey, salt);

  // Test lines 289-294: two entries, source first, destination second. The
  // order is signed, so it cannot be swapped.
  proof.hashesAndChainIds = [
    inputs.sourceChain,
    {
      chainId: inputs.chainId,
      sessionDigest: destinationSessionDigest({
        account: inputs.account,
        sessionKey: inputs.sessionKey,
        salt,
      }),
    },
  ];

  const { r, s, v } = await signOwnerAuthorization(
    ownerPrivateKey,
    ownerAuthorizationDigest(proof.hashesAndChainIds),
  );
  proof.ownerR = r;
  proof.ownerS = s;
  proof.ownerV = v;

  return { proof, permissionId: id, salt };
}

/**
 * The deliverable. Ported from `_prepareBatch`, AutoRenewPolicy.t.sol lines
 * 398-421, plus the session signature the test adds inside `_renewEnvelope`.
 *
 * Takes both keys as arguments and loads neither. The caller decides where
 * a key comes from; AGENTS.md rules 2 and 3 say which two keys it may never
 * be.
 *
 * `demo` takes `envelope` from the result and sends it. Nothing in this file
 * touches the network, so a payload this function returns is not yet a
 * claim about the chain's state: `renewPrice` was quoted at some block, and
 * a quote that has moved makes `_checkRenewBatch` refuse the batch on the
 * exact-amount check.
 */
export async function buildRenewSessionPayload(
  inputs: RenewSessionInputs,
  keys: { owner: Hex; session: Hex },
): Promise<RenewSessionPayload> {
  const sessionAddress = privateKeyToAccount(keys.session).address;
  if (sessionAddress.toLowerCase() !== inputs.sessionKey.toLowerCase()) {
    throw new Error(
      `session key ${sessionAddress} does not match inputs.sessionKey ${inputs.sessionKey}`,
    );
  }

  const { proof, permissionId: id } = await buildRenewSessionProof(inputs, keys.owner);
  // The PROOF always carries non-zero refund maxima; the validator refuses a
  // proof without them. The ACTUAL refund is what `settlement` selects.
  const gasRefund =
    inputs.settlement === "none" ? NO_GAS_REFUND : renewGasRefund(proof);
  const executions = renewExecutions({
    paymentToken: inputs.paymentToken,
    registrar: inputs.registrar,
    nameOwner: inputs.nameOwner,
    account: inputs.account,
    label: inputs.label,
    duration: inputs.duration,
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
    permissionId: id,
    proof,
    nonce: inputs.nonce,
    gasRefund,
    operationData,
    sessionSignature: await signRhinestoneMessage(keys.session, digest),
  });

  return {
    executions,
    operationData,
    executorOpsData: encodeExecutorOpsData(executions),
    permissionId: id,
    digest,
    envelope,
    accountSignature: accountSignature(envelope),
    proof,
    gasRefund,
  };
}
