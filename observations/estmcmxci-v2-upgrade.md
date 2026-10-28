# estmcmxci.eth -> ENSv2 upgrade

Snapshot taken 2026-10-28 14:54 UTC at mainnet block 26291959, BEFORE the
upgrade transaction. Every line below is a read. No owner key is used anywhere
in this project (AGENTS.md hard rule 3).

## Identifiers
    namehash   0x427b2985f0db3089e29a4523e3188aaece60c54eb932a355f4bf4c892c6b149f
    labelhash  0x9c9196f3d732b88e183d7103c16862c8b300ad5d4392876b01bdddcd071aa5fc

## Before: ENS v1
    registry owner       0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B
    registry resolver    0xF29100983E058B709F3D539b0c765937B804AC15
    BaseRegistrar owner  0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B
    nameExpires          1841158981 = 2028-05-05
    addr(bytes32)        0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B

    NOT WRAPPED: BaseRegistrar.ownerOf equals the registry owner. Wrapped
    names show the NameWrapper here instead.

## The owner address
    address   0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B
    balance   0.122148483494660617 ETH
    code      0xef0100612373d7003d694220f7800eeaf8e3924c0951d3

    It is an EOA. EIP-7702 does not make it a contract account: the key still
    controls it and it still sends ordinary signed transactions. What the code
    means is that a SetCode authorization was signed by this key at some point.
    0xef0100 + 20 bytes is the 7702 designator; the delegate is
    0x612373d7003d694220f7800eeaf8e3924c0951d3, verified on Etherscan as
    CaliburEntry (solc v0.8.29), Uniswap's 7702 implementation. Confirmed on
    two independent RPCs.

    CHECKED BEFORE THE UPGRADE, because yesterday's NoNFTAllowed finding is
    exactly this class of bug: the delegate DOES answer the receiver hooks.
      onERC721Received  -> 0x150b7a02 (correct magic)
      onERC1155Received -> 0xf23a6e61 (correct magic)
    So a safe-mint to this address will not revert, and there was no reason to
    remove the delegation first.

## Before: ENSv2
    ETHRegistry 0xf60aba43e1f7f3dab1186ff03b561401c9df85e2
    ownerOf(labelhash)   0x0000000000000000000000000000000000000000
    getExpiry(labelhash) 1846515781

    DO NOT over-read getExpiry: the v2 token id is derived by LibLabel.id, not
    the raw labelhash, so this read may not refer to this name. ownerOf
    returning zero is the reliable signal that the name is not yet in v2.

## Why this snapshot exists
    1. progress/contracts.md C10 concluded, from source only, that migrating
       does NOT create an HCA: nothing in src/ calls
       StandaloneHCAFactory.deploy, and MigrationHelper only READS
       authorizedOwnerOf. A real migration confirms or refutes that.
    2. To see what the v2 expiry becomes, and whether grace matches what
       config/networks.ts asserts: registrar 2,419,200s, ETHRenewerV1
       7,776,001s.

## After — the upgrade landed 2026-10-28 10:55-10:56 UTC, blocks 26291966-26291971

THREE transactions, in order:

    26291966  deploy(...) -> StandaloneHCAFactory 0x742bf21897a7...
              0xcfb089bd61f8c056bf5198bab5f985314d20fe096236d9d33e4be9aeed4c36ed
    26291968  approve(...) -> BaseRegistrar 0x57f1887a8bf1...
              0x87526efba3813043818bd756bc98fb55ede400d3942ec3d7ec12d469f18afb48
    26291971  0xf9056eaa -> the new HCA 0x9d31d3e5928f...
              0x30d2218bc88c16d1c2fcad04c4b0eb39933e205313186fe16334c66357be92a5

## FINDING 1: upgrading DID create an HCA. This qualifies C10.

`HCADeployed` from the mainnet factory in the first transaction:
    hca             0x9d31d3e5928ff2f016ced8b9edc3d48868a106c4   (77-byte proxy)
    owner           0x703ae03fb120ec91e9ed6d08ce8044e498cc789b   (the EOA)
    implementation  0x116f462fa078ec0009e9b25dcd60309e70aac4f4

C10 said migration does NOT create an HCA, and its SOURCE reading was correct:
no contract in `src/` calls `StandaloneHCAFactory.deploy`, and
`MigrationHelper` only READS `authorizedOwnerOf`. C10 also wrote that "a
frontend could of course bundle it into a flow a user perceives as one step,
and that is a UX question we cannot settle from the contracts". That is
exactly what happened: the ENS app sent the `deploy` itself as step one of
the upgrade.

So the correct statement is NOT "migration does not create an HCA". It is:
**no CONTRACT creates one, but the ENS upgrade flow does, off-chain, as its
first transaction.** Anyone who upgrades gets an HCA.

CONSEQUENCE FOR THE ASK: the 2,869 mainnet HCAs are very likely upgrade
artifacts rather than deliberate separate acts, and the population grows with
every upgrade. The C9 re-signing cost therefore lands on ordinary upgraders,
not on a small set of power users. Do not describe HCA holders as a niche.

## FINDING 2: the name went to the EOA, not the HCA. Architecture confirmed.

    v2 ownerOf(versioned id)  0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B
    v2 expiry                 1846515781 = 2028-07-06
    v1 registry owner         0xDa021A2C1C2F99574D861Ef8c6fA745851BEB7F6
    v1 BaseRegistrar owner    0xDa021A2C1C2F99574D861Ef8c6fA745851BEB7F6

This is independent mainnet confirmation of yesterday's `NoNFTAllowed`
finding on Sepolia: an HCA cannot be the registry-owner of a name, so the
name is held by the EOA and the HCA is an authorized caller beside it. That
is precisely the shape the auto-renew rule assumes.

## FINDING 3: the v2 token id is versioned. Record this, it wasted time.

`LibLabel.id(label)` is the plain keccak, but the TOKEN id replaces the low
32 bits with a version (`withVersion`). `ownerOf(rawLabelhash)` returns ZERO
and reads as "not in v2", which is wrong. With version 0 it returns the real
owner. `getExpiry` accepts the canonical id, which is why it answered while
`ownerOf` did not. The same trap produced a misleading zero on the Sepolia
demo name yesterday.

## FINDING 4: config/networks.ts migration controllers look stale.

The v1 name is now held by `0xDa021A2C1C2F99574D861Ef8c6fA745851BEB7F6`,
verified on Etherscan as `Graveyard`. That matches NEITHER
`LockedMigrationController` (0xc46bf3b6...) nor `UnlockedMigrationController`
(0xab821ca6...) in `config/networks.ts`. Either the migration path changed or
those entries are out of date. Re-read the mainnet deployment records before
anything in this project relies on them.

## Expiry note
v1 said 2028-05-05; v2 says 2028-07-06, about two months later. Not explained
here. Worth checking before quoting either number.
