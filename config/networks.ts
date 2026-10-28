// ENSv2 network configuration.
//
// One module, keyed by chain id. Nothing in this project may hardcode an
// address outside this file. Go-live is a chain-id change, nothing more.
//
// PROVENANCE. The two networks come from different branches of
// ensdomains/contracts-v2, because the mainnet deployment records live on the
// deployment branch and are not merged:
//
//   sepolia  post-audit-2                  commit 3e54cdb8   deployed 2026-10-01
//   mainnet  deploy/mainnet-v2-20261002    commit f85062d3   deployed 2026-10-18
//
// post-audit-2 is the source of truth. docs.ens.domains lags it.
//
// Addresses are perishable. The mainnet contracts were replaced twice in
// October 2026. Re-read the deployment records before a demo.
//
// VERIFIED 2026-10-22. Sepolia and mainnet returned identical values for every
// constant read: registrar grace 2,419,200; renewer grace 7,776,001;
// MIN_COMMITMENT_AGE 60; MAX_COMMITMENT_AGE 86,400; and the same one-year
// renewal price for a nine-character name. The claim that mainnet ENSv2 is
// Sepolia ENSv2 holds for everything measured. Only addresses and the token
// set differ.

export type Address = `0x${string}`;

export interface Expectations {
  /** Seconds. Read from ETHRegistrar.GRACE_PERIOD() and asserted at startup. */
  registrarGracePeriod: number | null;
  /** Seconds. Read from ETHRenewerV1.GRACE_PERIOD() and asserted at startup. */
  renewerGracePeriod: number | null;
  /** Token symbols the rent oracle accepts. Asserted with isPaymentToken(). */
  acceptedTokens: string[] | null;
  /** When the above were last read on chain. */
  verifiedAt: string | null;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  /** Dedicated provider, for anvil --fork-url and the test matrix. */
  rpcEnv: string;
  /** Keyless racer, for preflight, verification and expiry polling. */
  readRpcEnv: string;
  explorer: string;
  source: { branch: string; commit: string; deployedAt: string };
  addresses: Record<string, Address>;
  tokens: Record<string, Address>;
  /** True when the payment tokens are test mocks the demo can mint. */
  tokensAreMocks: boolean;
  /**
   * Contracts THIS PROJECT deployed. Never ENS's. Kept in its own map so the
   * two can never be confused: `addresses` is the official deployment, this is
   * our private stack. The matching records live in the clone under
   * contracts/deployments/sepolia-autorenew/, NOT the official namespace.
   */
  ourStack?: Record<string, Address>;
  /**
   * The one demo account and name this project registered for the renewal
   * demo. Not a deployed contract, so not in `ourStack`: `owner` is the
   * registry-owner EOA, `account` is the `ourStack.DemoAccount` HCA
   * instance the renewal session is bound to. `StandaloneSingleOwnerHCA`
   * rejects every ERC721/1155 receiver callback by design (see
   * `progress/evidence.md` E6.5), so the HCA account itself can never be
   * the name's registry-owner — `owner` is deliberately the human/EOA, not
   * `account`.
   */
  demoName?: {
    label: string;
    owner: Address;
    account: Address;
    tokenId: `0x${string}`;
    registeredAt: string;
    /** Seconds since epoch. Read from ETHRegistry.findExpiry(label). */
    expiry: number;
    /**
     * E9, 2026-10-27: a conforming resolver (VerifiableFactory proxy of
     * PERMITTED_RESOLVER_IMPL) set on this name, with `account` granted
     * ROLE_SET_ADDRESS on it via grantSetterRoles — NOT grantRoles, which
     * PermissionedResolver disables. See progress/evidence.md E9 and
     * Measured on chain, not read from docs.
     */
    resolver?: Address;
    resolverGrantedSetAddress?: boolean;
  };
  expect: Expectations;
}

export const sepolia: NetworkConfig = {
  name: "sepolia",
  chainId: 11155111,
  rpcEnv: "SEPOLIA_RPC_URL",
  readRpcEnv: "SEPOLIA_READ_RPC_URL",
  explorer: "https://sepolia.etherscan.io",
  source: {
    branch: "post-audit-2",
    commit: "3e54cdb8",
    deployedAt: "2026-10-01T07:55:02.016Z",
  },
  addresses: {
    BatchRegistrar: "0x4a4c8b7cdab6b19dc2cdb417cdb53a2ccbaf5322",
    DefaultReverseRegistrarAdapter: "0x36f97328e843e37520cbf530e9402791c2754066",
    ENSV2Resolver: "0x1cf3989ed3e5ec3cb1d731fc3777323813b61acf",
    ETHRegistrar: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
    ETHRegistry: "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4",
    ETHRenewerV1: "0xf2ece44980778966b8a0fccb3a9e339440f6e045",
    HCAOwnerAndSessionValidator: "0x4bf641590ab18e31b9f8789a3417a2620f860466",
    HCAUpgradeSet: "0xcde956d6e2949bc25a4273f93e0db6f68a1a6f34",
    LockedMigrationController: "0x6029a063d69b09d23c52a754a90e4fe43adac3a8",
    ManagedUniversalResolverProxy: "0x6d80F2172CFdEc5730fE683860C33d26fC42e6F1",
    PermissionedResolverImpl: "0x115eb53f0c60696633855f90b138178fb40b2b2c",
    PublicResolverV2: "0xdc4a563d00f5c3012b699794eb9e13a561be386f",
    RegistryUpgradeSet: "0xf0a6f68c28603bdf2881ca17476ee477c72cd2fe",
    ReverseRegistrarAdapter: "0x56bce5e727faa9d237341bb5b9e8a03d5919779d",
    RootRegistry: "0xb458d6a3a77919449d03e7a6903c26827c1ec43f",
    StandaloneHCAFactory: "0x6bad0176236e97b346b5dd13bcc8325b931ee8ab",
    StandaloneHCAImplementation: "0xc940e5c5bf263c0e097054aecf73826769a72cee",
    StandardRentPriceOracle: "0x8196665d4ca7488b6474a9ec8e7d2719fb42263a",
    UniversalResolverV2: "0x24e1d8e068620b647ca097f961a61055f4f42d72",
    UnlockedMigrationController: "0x2a35b94df22cc7354570be2284655e2cdc0e64a2",
    UpgradableUniversalResolverProxy: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
    VerifiableFactory: "0xda70306c98e97ece36f997a21368e53298572991",
    WrapperRegistryImpl: "0xbe768b63e5fbbfbb0ae97e9064e0002df8001880",
  },
  tokens: {
    USDC: "0x240b0316df57887dbbe58b586508b19e633a14aa", // MockUSDC, ENS-deployed
    DAI: "0xf6fac8a58a0be13b9197f27c41b73162fe32572b", // MockDAI, ENS-deployed
    // Circle's Sepolia USDC. Not in the deployment records; found by probing
    // the oracle. Faucetable, so it needs no mint rights. Same price.
    USDC_CIRCLE: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  tokensAreMocks: true,
  // Deployed by this project on 2026-10-27 from the project deployer
  // 0x41baA860cf727eAbbbE5f469E0cF5A0833148F31. These are OUR instances.
  // ENS's own equivalents (StandaloneHCAFactory 0x6bad0176...,
  // HCAOwnerAndSessionValidator 0x4bf64159..., HCAUpgradeSet 0xcde956d6...,
  // StandaloneHCAImplementation 0xc940e5c5...) are untouched. The first two
  // below were deployed via rocketh (deploy-v2 --resume --tags hca); the
  // last three were deployed directly with forge create/cast send,
  // bypassing rocketh's dependency cascade, because it pulls in a
  // setController registration on ENS's own v1 DefaultReverseRegistrar that
  // needs ENS's v1-owner key. Records: contracts/deployments/sepolia-autorenew/.
  // Full detail: progress/evidence.md E6.
  ourStack: {
    StandaloneHCAFactory: "0xe4e3738f62caeb641cc724378487c8c22fec537e",
    DefaultReverseRegistrarAdapter: "0x1b961e5994ead11ebcc4e53beeb8a36c91bab436",
    HCAOwnerAndSessionValidator: "0x8012aa1a220f34f519a902c8f446823e0dd363e5",
    HCAUpgradeSet: "0x19ec1e0f3b99364cf6a294552ef4a129dfe341c7",
    StandaloneHCAImplementation: "0x9e2deb6fb870aff73460d45314e5d73865f82d51",
    // One HCA account instance, deployed from StandaloneHCAFactory.deploy(),
    // owned by the deployer. tx 0x86e48adf1600eb903a4d67e4bb441977cd3be05d216bbab58c72f8a591700aa9,
    // block 12,007,668. progress/evidence.md E6.5.
    DemoAccount: "0xe4f6bbcf33656d55cc50cf2fad344c208243031f",
    // E9, 2026-10-27: a conforming resolver (VerifiableFactory proxy of
    // PERMITTED_RESOLVER_IMPL), deployed directly by the owner EOA, not
    // through the HCA. tx 0x2cdedab70e9ca8251bdb9d578db3d03bee15e2ff61b69d4b7758acb9fdd69fa3,
    // block 12,008,185. progress/evidence.md E9.
    DemoResolver: "0xf26c66e16584bffd88f72b45bc9c1e4dfab3a549",
  },
  // Registered 2026-10-27, tx 0xd8d7a0b183f82c4bc2e1bdb9ccc03b974f09f917b205ae0159c86e98ef21ee66,
  // block 12,007,695, paid 613,701 raw MockUSDC (getRegisterPrice quote, 28
  // days, 0 premium). progress/evidence.md E6.5. Renewed 2026-10-27 by the
  // manager: tx 0x5c8e9a9d1b3a7ba0235377c85f251e9dad40a2900dd206b7341a96fa7051eb95,
  // block 12,008,109. progress/evidence.md E7.
  demoName: {
    label: "autorenewdemo",
    owner: "0x41baA860cf727eAbbbE5f469E0cF5A0833148F31",
    account: "0xe4f6bbcf33656d55cc50cf2fad344c208243031f",
    tokenId: "0xf2716ccc53eb7816e23600d4f47fb6a4a5ea0fb5b8748f9743207138dda3e974",
    registeredAt: "2026-10-27",
    // Read via findExpiry("autorenewdemo") on ETHRegistry, 2026-10-27, AFTER
    // the renewal. 1,827,111,780 = 2026-11-25T21:03:00Z (was 1,795,554,180
    // before the renewal, a delta of exactly 31,557,600s, D9's fixed
    // duration). progress/evidence.md E7.
    expiry: 1827111780,
    // E9, 2026-10-27: tx 0x8998f781c7b9f7031add23c6ee9c0c01dadb0048ddaf8bd9ce0fb954dbc77be1
    // (setResolver, block 12,008,188) and
    // 0xaa06c2e4eb13121b5ab48d3f8c0835832b72a57daee58db6d47e10da4ec61c1b
    // (grantSetterRoles, block 12,008,201). progress/evidence.md E9.
    resolver: "0xf26c66e16584bffd88f72b45bc9c1e4dfab3a549",
    resolverGrantedSetAddress: true,
  },
  expect: {
    registrarGracePeriod: 2_419_200, // 28 days, same as mainnet
    renewerGracePeriod: 7_776_001, // 90 days + 1s, same as mainnet
    acceptedTokens: ["USDC", "DAI", "USDC_CIRCLE"],
    verifiedAt: "2026-10-22",
  },
};

export const mainnet: NetworkConfig = {
  name: "mainnet",
  chainId: 1,
  rpcEnv: "MAINNET_RPC_URL",
  readRpcEnv: "MAINNET_READ_RPC_URL",
  explorer: "https://etherscan.io",
  source: {
    branch: "deploy/mainnet-v2-20261002",
    commit: "f85062d3",
    deployedAt: "2026-10-18T03:02:26.325Z",
  },
  addresses: {
    BatchRegistrar: "0xf0ccfbf6dba1e01ccb833ced6d551a8f000e9721",
    DefaultReverseRegistrarAdapter: "0xd86e32499ecafe9c181dd7410f93a1a9bb61ef0d",
    ENSV2Resolver: "0x3071ad643ce4ed8b3d67b289845b45db82b068a4",
    ETHRegistrar: "0xd6d8369e55c94ae8afa714e6cf7ab5be54d5cc81",
    ETHRegistry: "0xf60aba43e1f7f3dab1186ff03b561401c9df85e2",
    ETHRenewerV1: "0x56c447f308f463a01121c41e72b0e7e7557fcb68",
    HCAOwnerAndSessionValidator: "0xa818428ed2f3f949bdc71b8a15bdd7b5d27ce938",
    HCAUpgradeSet: "0x85e115f5b43c72e2ba4419a9a95e325db18431c2",
    LockedMigrationController: "0xc46bf3b6c7ebcffd4ecfc3b012a1726a2463694d",
    ManagedUniversalResolverProxy: "0xcffd2ae680cd110d28739a70922636b5937b022b",
    PermissionedResolverImpl: "0x565b0f456a04ac9b48758190e90030623cff57c5",
    PublicResolverV2: "0x66f9f566ff2f26309c1bd9134388478a801da3e1",
    RegistryUpgradeSet: "0x573a73c0b3c0c90bb8bd728519434af19fb88935",
    ReverseRegistrarAdapter: "0x349151735790269a9c14668b58d7c83b5ecb9607",
    RootRegistry: "0x2553c09be6447beffdb86fa622ad41fb8f77a91e",
    StandaloneHCAFactory: "0x742bf21897a78e2c98cc5f5c5473a370a081e561",
    StandaloneHCAImplementation: "0x116f462fa078ec0009e9b25dcd60309e70aac4f4",
    StandardRentPriceOracle: "0x76f29609a363a8a1a2a6abe2e859c0f8916af469",
    UniversalResolverV2: "0x06fdd07f007adac667177b46ab2eb9a75132cfd5",
    UnlockedMigrationController: "0xab821ca676cf2e0790fa273526a165cfa86aeb64",
    UpgradableUniversalResolverProxy: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
    VerifiableFactory: "0x77510ba162dfea3d8989e3f0928a691b345730d2",
    WrapperRegistryImpl: "0xcf3edb3f5501de63b57254d910b6782ee370039b",
  },
  tokens: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  tokensAreMocks: false,
  expect: {
    registrarGracePeriod: 2_419_200, // 28 days
    renewerGracePeriod: 7_776_001, // 90 days + 1s, includes the bonus period
    acceptedTokens: ["USDC", "DAI"], // WETH and USDT rejected
    verifiedAt: "2026-10-22",
  },
};

/** Governance. Not per-network config; recorded so nothing guesses it. */
export const governance = {
  mainnet: {
    /** Holds APPROVE / APPROVE_ADMIN on HCAUpgradeSet. An executable DAO vote. */
    daoTimelock: "0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7" as Address,
    /** Roles on ManagedUniversalResolverProxy only. No authority over HCA. */
    securityCouncilSafe: "0x7101B78638e34444F0a5AdE9e1149fbEeC029931" as Address,
    /**
     * StandaloneHCAImplementation has no owner. A change is not an edit: it
     * means deploying a new implementation and approving it into the sets.
     */
    implementationOwner: "0x0000000000000000000000000000000000000000" as Address,
  },
  sepolia: {
    /**
     * Holds the full root bitmap (APPROVE, APPROVE_ADMIN, CAN_NAME,
     * CAN_NAME_ADMIN) on HCAUpgradeSet, granted once at deploy and never
     * changed since. A plain EOA (codesize 0), not a timelock or multisig.
     * VERIFIED 2026-10-22, read on chain. Does NOT match mainnet, where the
     * ENS DAO timelock holds the same bitmap. Do not treat this key as
     * equivalent to mainnet governance.
     */
    deployerRoot: "0x84D3A426D4E12E955d1DF95db0b24Fe26AFE39D3" as Address,
  },
} as const;

const NETWORKS: Record<number, NetworkConfig> = {
  [sepolia.chainId]: sepolia,
  [mainnet.chainId]: mainnet,
};

/**
 * The only way to reach a network config.
 *
 * Throws on an unknown chain id. Do not add a default. A silent fallback is
 * how a demo runs against the wrong network and nobody notices.
 */
export function getNetwork(chainId: number): NetworkConfig {
  const net = NETWORKS[chainId];
  if (!net) {
    const known = Object.keys(NETWORKS).join(", ");
    throw new Error(
      `No ENSv2 config for chain id ${chainId}. Known: ${known}. ` +
        `Add it to config/networks.ts from the deployment records on post-audit-2.`,
    );
  }
  return net;
}

/** A fork keeps the forked chain's id, so this resolves a fork correctly. */
export function getAddress(chainId: number, contract: string): Address {
  const net = getNetwork(chainId);
  const addr = net.addresses[contract];
  if (!addr) {
    throw new Error(
      `No address for "${contract}" on ${net.name}. ` +
        `Check the spelling against config/networks.ts.`,
    );
  }
  return addr;
}
