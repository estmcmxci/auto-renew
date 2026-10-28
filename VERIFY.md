# Open items

Each item is unconfirmed. Clear it before it enters a proposal. Record the
evidence and the date in this file.

Status key: OPEN, DONE, BLOCKED.

---

## 1. Minimum registration duration in ENSv2

**Status:** DONE both networks, 2026-10-22. There IS a minimum: 28 days.

**Why it matters:** It decides whether the Sepolia evidence can show a full
expiry cycle. ENSv1 enforces 28 days. v2 keeps a minimum too, so a public
testnet cannot show a name lapse inside a short demo window; only a local
fork with warped time can.

**Method:** Read the registration path in `ETHRegistrar` and the rent oracle on
the target network. Check for a minimum duration constant or a revert.

**Evidence:** 2026-10-22. `MIN_REGISTRATION_DURATION`, `MIN_DURATION` and
`minDuration` all revert as named getters on `ETHRegistrar` 0xd6d8369e
(mainnet) and `StandardRentPriceOracle` 0x76F29609. No such constant is
exposed under those names.

The constant exists under a different name. Read in the clone,
`contracts-v2/contracts/src/registrar/ETHRegistrar.sol` (commit `3e54cdb8`,
branch `post-audit-2`):

- Line 53: `uint64 public immutable MIN_REGISTER_DURATION;` — set once in the
  constructor (line 100), so its value is a deployment choice, not a
  protocol-wide constant.
- Lines 254–256, inside `_requireAvailable`, called from `register()` (line
  142) and `getRegisterPrice()` (line 187):
  `if (duration < MIN_REGISTER_DURATION) { revert DurationTooShort(duration, MIN_REGISTER_DURATION); }`

Confirmed on chain with `cast call MIN_REGISTER_DURATION()(uint64)`, 2026-10-22:

| Network | Contract | `MIN_REGISTER_DURATION` | Days |
| --- | --- | --- | --- |
| mainnet | `ETHRegistrar` 0xd6d8369e | 2,419,200 | 28 |
| sepolia | `ETHRegistrar` 0xf633e7fc | 2,419,200 | 28 |

Both networks deployed the same value, and it equals `GRACE_PERIOD` (item 2)
on both. That match may be deliberate (a name can't lapse before its grace
window could close anyway) or coincidental; not verified which.

Note `MIN_RENEW_DURATION = 1` second is a separate constant, in
`AbstractETHRegistrar.sol` line 22. It bounds `renew()`, not `register()`.
A name can be renewed for as little as one second once it exists; it cannot
be *registered* for less than 28 days.

Confirmed on the deployed contracts, not just in source, on the Sepolia fork
on 2026-10-22 with `cast call MIN_RENEW_DURATION()(uint64)`:

| Contract | `MIN_RENEW_DURATION` |
| --- | --- |
| `ETHRenewerV1` | 1 |
| `ETHRegistrar` | 1 |

`ETHRegistrar.MIN_REGISTER_DURATION` read 2419200 in the same pass, so the two
floors differ on the same contract. The enforcement site for renewal is
`AbstractETHRegistrar.sol` line 165. So renewal has no meaningful floor, and
nothing in the protocol stops a one-second renewal. Any bound on renewal
duration must come from the session policy.

**Consequence for Sepolia evidence:** a freshly registered name cannot expire
before 28 days have passed. The demo cannot show a full register→expire→grace
lapse cycle on public Sepolia inside a short window. Showing the lapse needs
either a 28+ day wait on Sepolia, or a local fork where `block.timestamp` is
warped forward.

---

## 2. Grace period in the live deployment

**Status:** DONE both networks, 2026-10-22

**Why it matters:** The PRD states that a name stays renewable through the
grace period. The figure is a constructor argument, not a constant. In
`ETHRenewerV1` it is `GRACE_PERIOD = bonusPeriod + gracePeriod`, so the v1
renewer and the v2 registrar can differ.

**Method:** Read `GRACE_PERIOD` from the deployed `ETHRenewerV1` and from
`ETHRegistrar`. Record both.

**Evidence:** mainnet, 2026-10-22, via `cast call`.

| Network | Contract | `GRACE_PERIOD` | Days |
| --- | --- | --- | --- |
| mainnet | `ETHRegistrar` 0xd6d8369e | 2,419,200 | 28 |
| mainnet | `ETHRenewerV1` 0x56c447f3 | 7,776,001 | 90 + 1 second |
| sepolia | `ETHRegistrar` 0xf633e7fc | 2,419,200 | 28 |
| sepolia | `ETHRenewerV1` 0xf2ece449 | 7,776,001 | 90 + 1 second |

The two networks are identical. `MIN_COMMITMENT_AGE` is 60 seconds and
`MAX_COMMITMENT_AGE` is 86,400 seconds on both.

The v2 native grace is 28 days. `ETHRenewerV1` sets
`GRACE_PERIOD = bonusPeriod + gracePeriod`, so the bonus period is about 62
days. A premigrated v1 name keeps a 90-day window. A native v2 name gets 28.

The PRD previously implied one figure of 90 days. Corrected.

---

## 3. Resolver role-grant API for a delegate contract

**Status:** DONE, 2026-10-27. Session-driven, with two preconditions. The
role-grant API exists, is not what the EnhancedAccessControl base contract
declares, and is needed only when the resolver was not deployed through the
HCA.

**Why it matters:** The fallback path needs it only if the fallback is a
standalone contract. A session-driven fallback does not need it, because the
session already permits `setAddress` — THIS HALF of `ERD.md` section 5's "no
contract change" claim is CORRECT. But the ERD misses two preconditions a
session must satisfy, and a third about which resolver qualifies at all.
Neither precondition is a PR to ENS.

**Method corrected.** The original wording — "find the call that grants one
named role on one name to one address" — is wrong about the scope and was
corrected rather than left for the next reader to over-trust: a grant is NOT
scoped to a name. `PermissionedResolver.setAddress` is
`onlyRoles(resource(coinType), ROLE_SET_ADDRESS)`, and `resource(uint256)` is
the hash of the COIN TYPE, not of the name or the node. On a per-name resolver
proxy (the shape this project uses) that is the same thing in practice, since
each name gets its own proxy; on a SHARED resolver, one grant would cover
every name that resolver serves, which is the over-trust risk the old wording
invited.

**Evidence**

Read live on Sepolia, clone `3e54cdb8`, 2026-10-27. Full chain of reasoning
and every line reference: `progress/contracts.md` C8.

1. The policy already allowlists the selector.
   `HCAResolverPolicyLib._isRecordSelector` lists `setAddress` alongside the
   other record setters. No new validator rule needed for the selector
   itself.
2. The session's proof MUST NAME the resolver. The resolver branch is gated
   on `proof.resolver != address(0)`. This project's renew proof sets
   `resolver = address(0)` deliberately (a renewal touches no resolver), so
   a `setAddress` execution under THAT session is refused. Measured live,
   twice: `isValidSignatureWithSender` on the live validator
   `0x8012Aa1a220F34f519A902C8f446823E0Dd363E5`, called directly (not
   through the account, which would swallow the revert into a clean
   `0xffffffff`) — a `setAddress` execution under a `resolver = 0` proof
   reverted; the SAME execution under a proof naming a real resolver
   returned `0x1626ba7e`, accepted. `operator/c8-probe.ts`, read-only, is
   the probe; its cases A and B are that pair. (One wording note, not a
   finding: C8's own prose said this returns a clean `0xffffffff`, which is
   the account-level behavior; querying the validator directly, as the
   script actually does, surfaces a raw revert instead. Same conclusion —
   refused — different shape of "refused." See `progress/evidence.md` E9.)
3. The resolver must be a `VerifiableFactory` proxy of
   `PERMITTED_RESOLVER_IMPL` (`0x115eb53F0c60696633855F90b138178Fb40b2b2C`
   on this deployment). `HCAResolverPolicyLib.checkBinding` requires
   `IVerifiableFactory.verifyContract(resolver)` to return exactly that
   address. The shared ENS-deployed `ENSV2Resolver` would be refused.
4. The grant call, measured live, is NOT `grantRoles`. `PermissionedResolver`
   OVERRIDES `EnhancedAccessControl.grantRoles` with a version that always
   reverts `EACCannotGrantRoles` (`src/resolver/PermissionedResolver.sol`
   line 297, `pure`, unconditional) — a correction to C8 section 4, which
   read only the base `EnhancedAccessControl` declaration and did not call
   `grantRoles` live against a resolver instance to notice the override.
   The real API is `grantSetterRoles(bytes setter, address account)`, where
   `setter` is the same calldata shape as the target setter call (here,
   `setAddress(name, coinType, value)`); it decodes the role and resource
   from that shape itself, so the caller cannot name an arbitrary
   resource/roleBitmap pair the way the base function's signature suggests.
   Confirmed live: `grantRoles` reverted exactly as predicted;
   `grantSetterRoles` with a `setAddress`-shaped setter succeeded, and
   `hasRoles(resource(60), ROLE_SET_ADDRESS, account)` read `true`
   afterward. Tx and addresses: `progress/evidence.md` E9.
5. A name registered THROUGH the HCA's own factory-deploy path needs no
   separate grant — `HCAResolverPolicyLib.checkDeployment` requires the
   resolver's own initializer to grant both the HCA and its owner full
   access at deployment. A name registered directly by an EOA, as
   `autorenewdemo` was (E5/E6.5), has no such resolver and needs one
   deployed and granted by hand — which is the route E9 used, recorded as
   its own separate transactions rather than folded into the registration.
6. `autorenewdemo` had no resolver at all before E9 —
   `getResolver("autorenewdemo")` returned `address(0)`. E9 deployed a
   conforming resolver, set it on the name, and granted the HCA account
   `ROLE_SET_ADDRESS` on it. The fallback leg is now reachable: see item 4
   above and `progress/evidence.md` E9 for the live `0x1626ba7e` proof.

---

## 4. Registry accessor available to the validator

**Status:** DONE, 2026-10-22. Both halves measured. Tests 5 and 6 pass.

**Why it matters:** The rule binds the name to the owner through it.

**Known:** `IPermissionedRegistry` declares `latestOwnerOf(uint256)` and
`getState(uint256)`. `State` holds `status`, `expiry`, `latestOwner`, `tokenId`
and `resource`. Confirmed at commit `f85062d3`.

**RESOLVED, second half, 2026-10-22.** The grace and re-registration
behaviour is measured. Test 5 and test 6 both pass, so this item is DONE.

Inside the grace window, on a fork of Sepolia against the deployed registry:

| Call | Result |
| --- | --- |
| `getState(labelhash).latestOwner` | the owner |
| `ownerOf(labelhash)` | `0x0000…0000` |

So `ownerOf` would refuse every renewal in the window the product exists for,
and the accessor choice is load-bearing rather than cosmetic.

After the name lapses past the grace period and a third party registers it,
`latestOwner` becomes the third party and the old session is refused with
`PolicyRuleFailed`. The rule reads the registry on every call, so it corrects
itself and grants no permanent right to a name.

Both are asserted inside the tests, not just observed once.

**RESOLVED, first half, 2026-10-22.** Which accessor the validator can reach is
now settled: **`getState`, not `latestOwnerOf`.**

`latestOwnerOf(tokenId)` is `return super.ownerOf(tokenId)`,
`PermissionedRegistry.sol` line 374. It does no id reconstruction, so it needs
the VERSIONED token id. `getState(anyId)`, line 361, accepts a labelhash or a
token id and rebuilds the real id with `_constructTokenId`.

The validator holds a label, not a token id, so it must use `getState`.

**Evidence.** Measured on the Sepolia fork, 2026-10-22. A real registration
was taken from a `TransferSingle` log on `ETHRegistry`: token id
`0xb1b0e712...af4b00000000`, minted by `ETHRegistrar` to
`0xAD0F6223aFac460386fae5B028E3150D15E04dc8`. The low 32 bits of a live token
id are the version, and they read zero here. The same id with the low bits set
to `0x12345678` stands in for a bare labelhash:

| Call | Result |
| --- | --- |
| `latestOwnerOf(real token id)` | `0xAD0F…4dc8` |
| `latestOwnerOf(low bits 0x12345678)` | `0x0000…0000` |
| `getState(real token id).latestOwner` | `0xAD0F…4dc8` |
| `getState(low bits 0x12345678).latestOwner` | `0xAD0F…4dc8` |

So `getState` finds the owner whatever the low bits hold, and `latestOwnerOf`
does not. The validator used `latestOwnerOf(LibLabel.id(label))` until this was
found; it read zero and refused every renewal. Fixed in `_checkRenewCall`.

Side note, and it explains a confusing earlier reading. `test`, `alice`,
`vitalik` and `nick` all return a zero `latestOwner` from `getState` while
carrying an expiry. They are reservations with no owner, which matches item 6:
registration and migration are not open. Do not use them as owned names in a
test.

---

## 5. Payment tokens the rent oracle accepts

**Status:** DONE both networks, 2026-10-22. Re-check after any deployment change.

**Why it matters:** Renewal is denominated in ERC-20. A token in a deployment
list is not proof that the oracle takes it.

**Method:** Call `isPaymentToken(token)` on `StandardRentPriceOracle` for each
candidate. Re-check after any deployment change.

**Evidence:** mainnet, 2026-10-22. Oracle 0x76F29609A363a8A1a2a6abe2e859C0F8916Af469.
`ETHRegistrar` and `ETHRenewerV1` share this oracle.

| Token | Accepted |
| --- | --- |
| USDC | yes |
| DAI | yes |
| WETH | no |
| USDT | no |

**Sepolia**, oracle 0x8196665d4ca7488b6474a9ec8e7d2719fb42263a. The registrar
reports this same oracle, so the config matches the chain.

| Token | Address | Accepted |
| --- | --- | --- |
| MockUSDC | 0x240b0316 | yes |
| MockDAI | 0xf6fac8a5 | yes |
| Circle Sepolia USDC | 0x1c7D4B19 | yes |

The third is not in the deployment records. It was found by probing. Symbol
`USDC`, 6 decimals, real Circle testnet token, so it is faucetable and needs no
mint rights.

Control tests confirm the check discriminates: the zero address, a junk EOA and
mainnet WETH all return false on Sepolia.

**Closed, 2026-10-22, via event log, not probing.** No view function
enumerates `_paymentRatios`, but every change to it (construction and
`updatePaymentToken`/`disablePaymentToken`) emits `PaymentTokenUpdated(IERC20
indexed paymentToken, uint128 numer, uint128 denom)`
(`contracts-v2/contracts/src/registrar/StandardRentPriceOracle.sol` lines 127,
209, 240, 244, 253; commit `3e54cdb8`), so the full log history is a complete
audit trail of every token that was ever accepted, including ones later
disabled. Queried `eth_getLogs` against `SEPOLIA_READ_RPC_URL`
(`https://evm.stupidtech.net/v1/11155111`) for topic
`0x2d9461f4916036390b11b47e528b3b051e2f8faa661e2a410dec33c82012ede4`
(`PaymentTokenUpdated(address,uint128,uint128)`) on oracle
0x8196665d4ca7488b6474a9ec8e7d2719fb42263a, from the deployment block
`0xb45d8e` (11,820,430) to the current block (11,971,426) — the single call
returned the full range with no pagination needed.

Result: exactly 3 events, all in the deployment transaction
(0xef1a8a2cafde1714413cc592ac21694b9bcc7dfb41e50fb5d4333a0dfeb1b747), one each
for MockUSDC, MockDAI and Circle Sepolia USDC. None since. So the three listed
above are not just the three somebody thought to probe — they are the
complete set the oracle has ever accepted, and nothing has been added or
disabled since deployment on 2026-10-01. The "open set, probe only" caveat
from the first pass at this item no longer holds for Sepolia; replaced by this
closed result. The same method applies to mainnet but was not run there this
pass — do not carry this closure over to mainnet's row above without rerunning
it.

**Price**, both networks, same date:
`getRenewPrice("estmcmxci", 1846515781, 31557600, USDC)` returns 8,005,501,
which is 8.0055 USDC for one year on a nine-character name. Mainnet and Sepolia
agree to the unit.

Use this to ground the spend cap. Leave headroom: the oracle price moves.

**Mintability of the two mock tokens, 2026-10-22.** Sepolia `MockUSDC`
(0x240b0316df57887dbbe58b586508b19e633a14aa) and `MockDAI`
(0xf6fac8a58a0be13b9197f27c41b73162fe32572b) are deployed from this project's
own `contracts-v2/contracts/test/mocks/MockERC20.sol` (commit `3e54cdb8`),
not the vendored forge-std mock. Its `mint(address to, uint256 amount)
external` (line 26) carries no modifier and no caller check of any kind — it
calls `_mint` directly. Confirmed live, not just from source: simulated
`mint(0x41baA860cf727eAbbbE5f469E0cF5A0833148F31, <amount>)` on both
contracts with `cast call ... --from 0x000000000000000000000000000000000000dEaD`
(an address with no prior relationship to either token) against
`SEPOLIA_READ_RPC_URL`. Both calls succeeded (no revert) from that
unprivileged, unrelated caller, so minting is open to anyone, not gated to a
deployer or owner. No transaction was sent; `cast call` only simulates.

Consequence: the payment-token half of `progress/evidence.md` E5 does not
need a faucet at all. Once the deployer holds any Sepolia ETH for gas, it can
self-mint MockUSDC and/or MockDAI directly:

```
cast send 0x240b0316df57887dbbe58b586508b19e633a14aa \
  "mint(address,uint256)" <DEPLOYER_ADDRESS> 1000000000 \
  --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
# 1,000,000,000 raw units = 1,000 MockUSDC (6 decimals)

cast send 0xf6fac8a58a0be13b9197f27c41b73162fe32572b \
  "mint(address,uint256)" <DEPLOYER_ADDRESS> 1000000000000000000000 \
  --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
# 1,000,000,000,000,000,000,000 raw units = 1,000 MockDAI (18 decimals)
```

Circle Sepolia USDC (the third accepted token) was not tested for open
minting and is not expected to allow it — it is a real third-party testnet
token, not one of this project's mocks — so it still needs its own faucet if
it is ever used instead. Only Sepolia ETH for gas remains a human-faucet
dependency for E5.

**E5 closed, 2026-10-27.** Gas landed on the deployer
(0x41baA860cf727eAbbbE5f469E0cF5A0833148F31) — re-verified independently via
`cast balance` on `SEPOLIA_READ_RPC_URL` before acting (5,000,000,000,000,000
wei, matching the manager's report, not taken on claim alone). Ran both
`cast send` calls above for real, from `.env`'s `DEPLOYER_PRIVATE_KEY`
against `SEPOLIA_RPC_URL` (the dedicated provider, not the read-only racer):

- MockUSDC mint, tx
  `0x87809a39e356e27127732864c4960ee5b021da1ed98b4f2950e14496227a31b9`,
  block 12,007,159, status 1.
- MockDAI mint, tx
  `0xfa6042dbefae9ad3ce13a779dd16882fca0d0a05eb9d5508042ecdf76505bf6b`,
  block 12,007,160, status 1.

Post-tx balances, re-read fresh (not assumed from the send output): 1,000
MockUSDC, 1,000 MockDAI, 4,999,859,381,937,932 wei ETH remaining (nonce 2).
This is the project's first real Sepolia transaction. Full note in
`progress/evidence.md` E5.

---

## 6. Rollout stage

**Status:** DONE for mainnet, 2026-10-22. Perishable. Re-check before the demo.

Sepolia: ENSv2 is live. Native registration and renewal work through
`ETHRegistrar` 0xf633e7fc. This is why the demo runs there.

**Why it matters:** New `.eth` renewal through `ETHRegistrar` opens at Stage 4.
Before that, v1 names renew only through `ETHRenewerV1`. The demo must target
the registrar that is live.

**Method:** Check <https://enswhois.com/ensv2/rollout>. Third-party and updated
often; useful, not authoritative. Confirm on chain with `isENSv2()` on the
configured Universal Resolver, then `ROOT_REGISTRY()`, then
`getSubregistry("eth")`.

**Evidence:** 2026-10-22, enswhois, for `estmcmxci.eth`.

```
v1_frozen          false
registrations_open false
migration_open     false
renewal via        ens_v1
v2 status          reserved, in sync, resolves
```

So native v2 registration and renewal are not open. Today a premigrated name
renews through `ETHRenewerV1`, not through `ETHRegistrar`.

Consequences:

- The mainnet fork demo targets `ETHRenewerV1`.
- Test 9 in the matrix is not hypothetical on mainnet. It is the live
  condition there until go-live.
- Migration is blocked on `migration_not_open`: the migration controllers do
  not yet hold the role to claim reserved names.

Also recorded, same source: `MIN_COMMITMENT_AGE` is 60 seconds and
`MAX_COMMITMENT_AGE` is 86,400 seconds on `ETHRegistrar`.

---

## 7. Sepolia governance of HCAUpgradeSet

**Status:** DONE, 2026-10-22.

**Why it matters:** `config/networks.ts` recorded mainnet's `HCAUpgradeSet`
root-role holder (the DAO timelock) but left Sepolia's holder unknown, with
an explicit instruction not to assume it matches. Anything that treats
Sepolia's HCA-implementation-approval path as governed the way mainnet's is
would be wrong.

**Method:** `HCAUpgradeSet` is a `PermissionedAddressSet`
(`contracts-v2/contracts/src/utils/PermissionedAddressSet.sol`, commit
`3e54cdb8`). Its constructor grants one `rootAccount` the full
`DEFAULT_ROLE_BITMAP` (`ROLE_APPROVE | ROLE_APPROVE_ADMIN | ROLE_CAN_NAME |
ROLE_CAN_NAME_ADMIN`, same file line 18; role bit values in
`utils/interfaces/IPermissionedAddressSet.sol` lines 9–18). The deployment
record `contracts-v2/contracts/deployments/sepolia/HCAUpgradeSet.json`
(`argsData`) decodes to that constructor argument — a deployment record is
not evidence by itself, so the candidate was then confirmed live on chain
with `cast call` against `SEPOLIA_READ_RPC_URL`
(`https://evm.stupidtech.net/v1/11155111`), and cross-checked the same way
against mainnet's known holder.

**Evidence:** 2026-10-22, Sepolia `HCAUpgradeSet`
0xcde956d6e2949bc25a4273f93e0db6f68a1a6f34.

| Call | Result |
| --- | --- |
| `roles(0, 0x84D3A426D4E12E955d1DF95db0b24Fe26AFE39D3)` | `0x1100000000000000000000000000000011` — exactly `DEFAULT_ROLE_BITMAP` |
| `roleCount(0)` | same value — no role on this resource has an assignee outside the above |
| `getAssigneeCount(0, DEFAULT_ROLE_BITMAP)` | counts `0x1100000000000000000000000000000011`, 1 assignee per role, matching `roleCount` exactly |
| `cast code` on that address | `0x` — an EOA, not a contract |

So on Sepolia, `0x84D3A426D4E12E955d1DF95db0b24Fe26AFE39D3` is the *only*
holder of `ROLE_APPROVE`, `ROLE_APPROVE_ADMIN`, `ROLE_CAN_NAME` and
`ROLE_CAN_NAME_ADMIN` on `HCAUpgradeSet`'s root resource, granted once at
deploy (no `EACRolesChanged` activity beyond construction is implied by
`roleCount` matching the single grant exactly), and it is a plain EOA.

Cross-check, same method, mainnet `HCAUpgradeSet`
0x85e115f5b43c72e2ba4419a9a95e325db18431c2: the DAO timelock
`0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7` also returns the full
`DEFAULT_ROLE_BITMAP`, not only `ROLE_APPROVE`/`ROLE_APPROVE_ADMIN` as the
`governance.mainnet` comment in `config/networks.ts` said before this
finding; that comment is now corrected to list all four roles.

**Consequence:** Sepolia's HCA-upgrade approval path has no governance
structure — one EOA, not a DAO vote, decides which `StandaloneHCA`
implementation is approved into the set. Confirms the instruction already in
`config/networks.ts` not to assume Sepolia matches mainnet. Unverified and
out of scope for this item: whose EOA this is beyond "the post-audit-2
Sepolia deploy script's `owner` named account", and how its key is held. Do
not reuse this finding to claim anything about mainnet's upgrade safety.
