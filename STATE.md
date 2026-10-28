# State

Resume here. Update at the end of every session.

**Updated:** 2026-10-27 (thirteenth pass)

## Where this is

Specification written. No code yet.

## Done

- `PRD.md`, `ERD.md` written and patched for registrar selection and the
  authority distinction.
- `AGENTS.md`, `VERIFY.md`, `DEMO-SCRIPT.md`, `THREAT-MODEL.md` (draft),
  `reference/` written.
- `.gitignore`, `.env.example`, `STATE.md`, `DECISIONS.md` written.
- `config/` pack written: `networks.ts`, `preflight.ts`, `README.md`. Both
  networks pinned, expectations verified on chain for both.
- `contracts-v2` cloned at `post-audit-2`, commit `3e54cdb8`.
- `ERD.md` re-pointed at Sepolia.
- `addresses.json` removed. `config/networks.ts` is the only address source.
- `test/AutoRenewPolicy.t.sol` skeleton written. Nine empty cases.

## Verified on chain, 2026-10-22

- v2 native grace is 28 days. `ETHRenewerV1` gives 90 days and one second to
  premigrated names, through a bonus period. Not one figure. `VERIFY.md` 2.
- The oracle takes USDC and DAI. Not WETH, not USDT. One year on a
  nine-character name costs 8.0055 USDC. `VERIFY.md` 5.
- Rollout: registrations and migration are **not open**. v1 is not frozen.
  Renewal today goes through `ETHRenewerV1`. `VERIFY.md` 6.
- There IS a minimum registration duration: 28 days, both networks, matching
  `GRACE_PERIOD`. `MIN_REGISTER_DURATION` in `ETHRegistrar.sol` line 53,
  enforced line 254-256. Sepolia cannot show a full register-expire-grace
  cycle in a short demo window without a time-warped fork. `VERIFY.md` 1.
- Sepolia `HCAUpgradeSet` root roles: one EOA
  (`0x84D3A426D4E12E955d1DF95db0b24Fe26AFE39D3`), not a DAO timelock, holds
  the full root bitmap and is the only holder. Does not match mainnet's
  governance shape (DAO timelock holds the same bitmap there). `VERIFY.md` 7.

## Funded and live on Sepolia, 2026-10-27

Deployer `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31` holds gas (0.005 ETH,
re-verified on chain before acting) and both mock payment tokens, self-minted
in two real transactions: MockUSDC
(`0x87809a39e356e27127732864c4960ee5b021da1ed98b4f2950e14496227a31b9`, block
12,007,159) and MockDAI
(`0xfa6042dbefae9ad3ce13a779dd16882fca0d0a05eb9d5508042ecdf76505bf6b`, block
12,007,160). This is the project's first real Sepolia transaction. 1,000 of
each token, ~4,999,859,381,937,932 wei ETH remaining, nonce 2. `VERIFY.md` 5,
`progress/evidence.md` E5.

## Private HCA stack, DONE on Sepolia, 2026-10-27

Finished by going around the blocker below: deployed the remaining three
contracts and ran the approval call directly with `forge create`/`cast
send`, bypassing rocketh's dependency cascade so the ENS-v1-owner call was
never reached. `HCAOwnerAndSessionValidator` at
`0x8012Aa1a220F34f519A902C8f446823E0Dd363E5`, a private `HCAUpgradeSet` at
`0x19Ec1e0F3b99364CF6a294552Ef4a129DfE341c7`, `StandaloneHCAImplementation`
at `0x9E2deb6Fb870afF73460D45314e5D73865f82D51`, approved on the private
factory (`setImplementationApproval`, confirmed true on re-read). Four txs,
blocks 12,007,298-12,007,302, all independently verified with `cast
receipt`/`cast call`. Full detail and every constructor arg's source:
`progress/evidence.md` E6, fourth update. E6 is closed.

## Private HCA stack, partly deployed on Sepolia, 2026-10-27 (historical — see above for the finish)

The clone builds now: `bun install` (456 packages) and `bun run compile`
(`forge build` + `hardhat compile`, 0 errors) both ran clean. Item 1 below is
done.

Ran `bun ./script/migrate.ts phase deploy-v2 --network sepolia --resume
--tags hca` for real. Two real transactions landed, both confirmed on chain:
a private, deployer-owned `StandaloneHCAFactory` at
`0xE4e3738f62CaeB641CC724378487c8c22fEC537E` (tx
`0x5f949f75752a040219d954a0d57c4df59eeca32383bf1f0cfbfb97c26612474c`, block
12,007,235), and the `DefaultReverseRegistrarAdapter` instance it pulled in
as a dependency, rewired to that private factory, at
`0x1B961e5994EaD11eBcc4E53beeb8a36c91baB436` (tx
`0x938f2421edc9bef8d1d9552c94862def6a6c8ef27d55b6c3ea8cc7e210e39820`, block
12,007,236). The shared/official factory and adapter `config/networks.ts`
points at are untouched. The run then hit an HTTP 400 from Alchemy on the
next send and stopped; the private `HCAOwnerAndSessionValidator`,
`StandaloneHCAImplementation`, and `HCAUpgradeSet`, and the factory's
implementation-approval call, are not deployed yet. Full detail, the exact
command, and why `--resume --tags hca` (not a fresh `--deployment-network`)
is the right invocation: `progress/evidence.md` E6.

E6 is now BLOCKED, root-caused: `--resume --tags hca` cannot finish, because
`01_HCAOwnerAndSessionValidator.ts`'s dependency chain pulls in a
`DefaultReverseRegistrarAdapter.setController` registration on ENS's own v1
`DefaultReverseRegistrar` (`0x4F382928805ba0e23B30cFB75fC9E848e82DFD47`),
which needs ENS's v1-owner signature — a signature this project does not
have and, per the item's own "request nothing from ENS," should not seek.
Confirmed by instrumenting the RPC provider to recover the error Alchemy
was actually sending (`Unsupported method: eth_sendTransaction`, because no
local key covers that account) rather than retrying blind. Detail and three
candidate paths forward: `progress/evidence.md` E6.

## Demo account and name, DONE on Sepolia, 2026-10-27

Correction from the manager: D4 (fixed duration, capped spend) was already
DECIDED 2026-10-22 — `STATE.md`'s "Open decisions" below was stale, conflating
it with the genuinely-open piece, the two default values. The manager set
those as D9: fixed renewal duration 31,557,600s (matches
`AutoRenewPolicy.t.sol`'s `RENEWAL_DURATION`), max spend = 2x the live
`getRenewPrice` quote read at install.

E6.5 (added by the manager, splitting E7's real setup work from the part
that waits on the operator's renewal-submit code, assigned elsewhere as
demo item O1): created an HCA account from the private factory
(`0xe4F6BB...031F`, owner = the deployer) and registered `autorenewdemo` to
it. FINDING: the account itself cannot be the name's registry-owner —
`StandaloneSingleOwnerHCA` rejects every ERC721/1155 receiver callback by
design (`NoNFTAllowed`), hit on the first attempt and read from source
before retrying. Registered to the deployer (EOA) instead, with the account
as the session the eventual renewal runs through. Tx
`0xd8d7a0b183f82c4bc2e1bdb9ccc03b974f09f917b205ae0159c86e98ef21ee66`, block
12,007,695. Recorded in `config/networks.ts` (`ourStack.DemoAccount`,
`demoName`) and `contracts/deployments/sepolia-autorenew/`. Full detail:
`progress/evidence.md` E6.5.

## The renewal happened. E7 is DONE, 2026-10-27.

The manager fired it directly against the live stack, after contracts
C6/C7 and a clean `eth_call` simulation. Every number re-read independently
on chain this beat, not taken on report: renewal tx
`0x5c8e9a9d1b3a7ba0235377c85f251e9dad40a2900dd206b7341a96fa7051eb95`
(status 1, block 12,008,109, `to` the Rhinestone IntentExecutor
`0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF`, selector `0x8f5c3522` =
`executeSinglechainOps`, confirmed against Rhinestone's own ABI). Name
`autorenewdemo` expiry moved `1795554180` → `1827111780`, a delta of
exactly `31557600`s — D9's fixed duration, to the second. Setup tx
(the owner's allowance grant to the HCA account, `16011002` = 2x the live
`8005501` price quote, D9's spend cap): tx
`0xeb9820aeee6ebd5834e6773a8b9c08271056e75342a206ba9fab6c11e608116b`,
block 12,008,103. Allowance and owner balance each dropped by exactly
`8005501` — the ERC-20 allowance acting as D6's period cap, funds moving
from the owner's wallet, never the HCA's own balance. Traced the
transaction (`cast run`) and confirmed the ERC-4337 validation chain runs
through this project's own patched `HCAOwnerAndSessionValidator`
(`0x8012Aa1a220F34f519A902C8f446823E0Dd363E5`), returning the ERC-1271
magic value at every level. Full detail: `progress/evidence.md` E7.

## The fallback leg is reachable. E9 is DONE, 2026-10-27.

Contracts measured (C8) that `VERIFY.md` item 3 was neither "needed" nor
"not needed" as framed: `setAddress` is already policy-allowlisted, but the
session's proof must NAME the resolver (our renew proof deliberately sets
`resolver = 0`), and the resolver must be a `VerifiableFactory` proxy of
`PERMITTED_RESOLVER_IMPL`. `autorenewdemo` had neither — `getResolver`
returned `address(0)` — because it was registered directly by the EOA, not
through the HCA's own resolver-deploying path (checked first, per C8
section 5, before doing anything manually).

Deployed a conforming resolver directly (`0xF26C66e16584BFfD88F72b45Bc9C1e4dFab3A549`,
tx `0x2cdedab70e9ca8251bdb9d578db3d03bee15e2ff61b69d4b7758acb9fdd69fa3`),
set it on the name (tx `0x8998f781c7b9f7031add23c6ee9c0c01dadb0048ddaf8bd9ce0fb954dbc77be1`),
and found a real correction to C8 along the way: `PermissionedResolver`
disables `grantRoles` entirely (always reverts); the live entry point is
`grantSetterRoles`, used instead (tx
`0xaa06c2e4eb13121b5ab48d3f8c0835832b72a57daee58db6d47e10da4ec61c1b`).
Re-ran contracts' own `operator/c8-probe.ts` with the real resolver in
place of its placeholder: a `setAddress` execution under a session proof
naming this resolver now returns `0x1626ba7e` — the fallback leg is
reachable. Full detail: `progress/evidence.md` E9, `VERIFY.md` item 3.

## Next

1. ~~Confirm the clone builds.~~ Done, 2026-10-27.
2. ~~Finish E6.~~ Done, 2026-10-27.
3. ~~E6.5: demo account + name.~~ Done, 2026-10-27.
4. ~~E7: the renewal transaction.~~ Done, 2026-10-27 — the manager fired it;
   see above. `test/AutoRenewPolicy.t.sol`'s nine cases were already
   passing (`progress/contracts.md` C1, 2026-10-22) and `VERIFY.md` item 4
   has been DONE since the same date; this item was stale, conflating the
   two.
5. ~~E9: fallback leg reachability.~~ Done, 2026-10-27 — see above. `VERIFY.md`
   item 3 is now DONE too; every item in that file is DONE. What remains is
   not a verification question anymore but a build one: the fallback path
   (`ERD.md` 7.2 step 4, write the fallback address on a funding failure)
   is still unbuilt in `operator/`, same as O1's renewal-submit code was
   before the manager fired E7 by hand. O1's own item in `progress/demo.md`
   already covers steps 3-5 of that; nothing new needs opening for it.
6. The lapse demo on public Sepolia needs a 28+ day wait, or the fork must
   carry the clock instead (see Fidelity question below — may need revisiting
   now that register also has a 28-day floor, not just the grace window).

## Fidelity question, RESOLVED

ENSv2 is live on Sepolia, so the demo runs there against the real
`ETHRegistrar`. Nothing is forced open and nothing needs labelling.

Sepolia carries the evidence. A fork of Sepolia carries the clock, because a
public chain cannot be fast-forwarded.

Mainnet goes live in about a month. Every constant read on 2026-10-22 matched
between the two networks, so go-live is a chain-id change.

## Decided

See `DECISIONS.md`.

- D1. Rhinestone: Nexus and the validator modules, `mockestrator` locally, our
  own keeper for the trigger. `ScheduledOrders` and `DeadmanSwitch` are
  precedent, not a service.
- D2. Frontend: Vite, React, wagmi and viem, `@ensdomains/thorin`.
- D3. Operator: a Node process locally, a Cloudflare Worker on Sepolia, from
  one shared core.

## Open decisions

None currently. The last one (default values for D4's two caps) was closed
by the manager 2026-10-27 as `DECISIONS.md` D9.

## Do not

- Open a PR into `ensdomains/contracts-v2` #465.
- Start the frontend before the test matrix passes.
- Treat anything in `reference/` as current. It is a snapshot at `f85062d3`.
