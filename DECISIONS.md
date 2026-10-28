# Decisions

One record for each settled decision. Date, choice, reason, evidence,
consequence. Do not re-open one without adding a new record.

---

## D4. Fixed duration or capped duration

**Date:** 2026-10-22
**Status:** DECIDED

**Decision**

Fix the duration. Cap the spend. This follows the `ERD.md` section 3.4.2
recommendation.

The session data holds:

- A fixed renewal duration, in seconds. The call must match it exactly. The
  caller does not choose it.
- A maximum spend for each period, in the payment token. The call must stay
  at or below it.

**Reason**

The duration can be a fixed value, because the owner knows it at install time.
The spend cannot, because the oracle price moves between install and execution.

A maximum leaves a stolen key a choice. A fixed value leaves it none. The cost
is that the owner must re-authorize to change the duration. For a renewal that
runs once a year, that cost is low.

Rhinestone sets the precedent. `SchedulingBase` uses fixed values, not maxima.
The amount sits in `executionData` at install.

**Evidence**

Read on 2026-10-22, in the clone of `ensdomains/contracts-v2` at
`post-audit-2`, commit `3e54cdb8`:

- `IETHRenewer.renew(RenewData calldata rd, IERC20 paymentToken)`.
  `RenewData` holds `string label`, `uint64 duration` and `bytes32 referrer`.
  The duration is caller-supplied, so the validator must bind it.
- `ETHRegistrar.sol` line 53 declares `MIN_REGISTER_DURATION`. Lines 254-256
  enforce it, but inside `_requireAvailable`, which is the register path.
  `ETHRegistrar` declares no `renew` of its own; it inherits one and overrides
  `_isRenewable`. So the 28-day floor is **not confirmed for renewal**. Do not
  state that renewal has a minimum duration.
- `IETHRenewer` declares `DurationTooShort(uint64 duration, uint64
  minDuration)`, so some renewal floor does exist. Where it is set, and its
  value, is unverified. Confirm before T3.
- `grep` over `src/` for `365 days`, `31536000`, `31557600` and `ONE_YEAR`
  returns nothing. The contracts define no year. "One year" is our number, not
  the protocol's. State it as a policy choice.

**Consequence**

1. R3 writes one fixed `renewalDuration` and one `maxSpendPerPeriod`, not two
   maxima. The field name `maxDurationPerRenewal` in `ERD.md` section 3.4 now
   misdescribes the field. Rename it to `renewalDuration` when R3 lands, and
   patch section 3.4.
2. T3 changes shape. The item reads "duration above the bound. REVERT." Under
   a fixed value, **any** duration that is not equal must revert, below as well
   as above. Test the unequal case in both directions.
3. `renew` takes the payment token as a parameter, so the caller chooses it. A
   spend cap in one token does not bind a call that pays in another. The rule
   must fix the payment token, or hold a cap for each token. the accepted-token set read on chain
   records USDC and DAI as accepted, so this is reachable, not theoretical.
   Decide it in R3.
4. Set the exact second value in R3 and justify it in `THREAT-MODEL.md`
   section 8 with the spend cap.

---

## D5. Which role the renew case checks

**Date:** 2026-10-22
**Status:** DECIDED by the owner

**Decision**

The renew case checks `ROLE_RENEW` at the registry root. It does not check
`ROLE_REGISTRAR`.

A new function `_isAuthorizedRenewer(address)` holds the check. It calls
`HCARegistrarPolicyLib.isRenewAuthorized`, which calls
`IPermissionedRegistry.hasRootRoles(RegistryRolesLib.ROLE_RENEW, account)`.

`_isAuthorizedRegistrar` is unchanged. The commit case and the register case
still use it.

**Reason**

The validator must ask the question the registry asks. The registry gates
renewal with `ROLE_RENEW`. A `ROLE_REGISTRAR` check asks a different question
and gets the wrong answer for `ETHRenewerV1`.

Two options were rejected:

- Keep `ROLE_REGISTRAR`. This ships a rule that cannot work until rollout
  Stage 4.
- Accept either role. This widens the policy surface for no gain. The registry
  refuses a `ROLE_REGISTRAR`-only contract anyway.

A role query survives a redeploy of either contract. An address does not.

**Evidence**

Read on the Sepolia fork, 127.0.0.1:8546, chain id 11155111, on 2026-10-22.
Addresses from `config/networks.ts`. Roles from `RegistryRolesLib.sol`:
`ROLE_REGISTRAR` is `1 << 0` at line 9, `ROLE_RENEW` is `1 << 16` at line 29.

| Call on `ETHRegistry` | Result |
| --- | --- |
| `hasRootRoles(1, ETHRenewerV1)` | false |
| `hasRootRoles(65536, ETHRenewerV1)` | true |
| `hasRootRoles(1, ETHRegistrar)` | true |
| `hasRootRoles(65536, ETHRegistrar)` | true |

Both contracts answer `supportsInterface(0x37e6a567)` true, so both expose
`IETHRenewer`.

`ERD.md` section 3.4.1 already recorded `ETHRenewerV1` with registry-wide
`RENEW`. The role table confirms it on chain.

**Consequence**

1. The validator admits a renewal through `ETHRenewerV1` and through
   `ETHRegistrar`. Both hold `ROLE_RENEW`. The rule does not narrow to one
   rollout stage.
2. `_isAuthorizedRenewer` does not pin the target into
   `state.authorizedRegistrar`. That slot selects the one registrar a batch
   may register through. A renewer is a different contract from the registrar,
   so sharing the slot would refuse a batch that registers and renews.
3. T7 now has two cases. Test a target with neither role, and a target with
   `ROLE_REGISTRAR` but not `ROLE_RENEW`. No deployed Sepolia contract fits
   the second case, because `ETHRegistrar` holds both roles. T7 needs a mock
   for it.
4. `ERD.md` sections 3.2 and 3.3 are patched to match.

---

## D6. Where the period cap lives

**Date:** 2026-10-22
**Status:** DECIDED by the owner

**Decision**

The period cap is the owner's ERC-20 allowance. It is not in the validator.

Build no period accounting. Add no storage to the validator.

Keep `maxRenewSpend` as a bound on one call, as a sanity check.

**Reason**

An earlier reading of `ERD.md` 3.4 asked for a "period spend" cap. That cannot
work in this validator, because its checks are `internal view` and it holds no
state. The question of how to add that state was the wrong question. The
premise was wrong.

No funds park anywhere. The money comes from the owner's wallet, up to the
allowance, and passes through the HCA in one atomic batch:

1. `paymentToken.transferFrom(wallet -> HCA, exact quoted price)`
2. `paymentToken.approve(registrar, exact quoted price)`
3. `registrar.renew(...)`

The HCA balance is zero before the batch and zero after it.

The allowance is stateful, and the token contract decrements it on every
`transferFrom`. So the token already enforces exactly the thing this stateless
validator cannot. A second accumulator inside the validator would duplicate it
and would need storage.

**Consequence**

1. The validator checks the SHAPE of the batch, not a running total:
   - the batch pulls the exact quoted price, with no over-funding and no
     residue in the HCA;
   - any approve goes to the selected registrar, for that same exact amount;
   - the `transferFrom` source is the owner's wallet, the destination is the
     HCA.
2. The registration route over-funds on purpose and leaves the remainder.
   Renewal must not copy that pattern.
3. Blast radius, for `THREAT-MODEL.md` section 3. A stolen session key can
   spend at most the REMAINING ALLOWANCE, and only on renewals of names the
   owner already holds. It cannot raise the allowance; only the owner can. The
   money goes to the ENS beneficiary, so the attacker gets nothing and the
   owner gets name-years. `revokeSessions()` ends it in one transaction. State
   the bound as the allowance.
4. `ERD.md` 3.4 is rewritten to match, and it now also carries the D4 field
   names.

---

## D7. The renewal numbers, and the renewability check

**Date:** 2026-10-22
**Status:** DECIDED by the owner

**Decision**

Three things, which close the last open questions on the rule.

1. **The duration is one year, 31557600 seconds, fixed.** The session data
   carries it. The call must match it exactly. The caller chooses nothing.
2. **`maxRenewSpend` is set per session, not in the contract.** It comes from
   `getRenewPrice` for the name that session renews, plus headroom for oracle
   drift.
3. ~~**The rule checks renewability before it reads the price,** and it fails
   with its own error.~~ **REVERSED 2026-10-28. See "Reversal of point 3"
   below.** The rule no longer makes that check. The price call makes it.

**Reason**

One year matches how the oracle quotes a price, and it keeps the keeper to one
firing each year. Because the match is exact, a stolen key can only make
full-price one-year calls. It cannot make the near-free dust renewal that
`MIN_RENEW_DURATION = 1` otherwise permits. The exact-duration match is the
check that does the work, not the spend cap.

The price depends on name length. One year costs 8.0055 USDC on a
nine-character name and 160.000009 USDC on `test`, four characters, measured on
the fork on 2026-10-22. That is about a twentyfold spread, so no single figure
can serve both. A per-session value is the only correct form.

`getRenewPrice` reverts `NameNotRenewable` for a name past its grace period. A
bubbled registrar error is not a policy decision, and the tests and the threat
model both have to state the behaviour exactly. So the rule asks first.

**Mechanism for the renewability check, and why**

The rule calls `IETHRenewer(target).isRenewable(label)` and reverts
`RenewalTargetNotRenewable(label)`, selector `0x0c8b8bba`, when it answers
false.

`isRenewable` was chosen over reading `status` from `getState`:

- `getState` cannot express the case that matters. `_constructStatus` returns
  `AVAILABLE` for any expired name, so a name inside its grace period and a
  name fully lapsed both read `AVAILABLE`. A `status == REGISTERED` test would
  refuse the grace-period renewal, which is test 5 and the most important case
  in the matrix.
- Grace is not one number. `ETHRenewerV1` grants 90 days and one second;
  native v2 grants 28 days. `isRenewable` is answered by the target itself, so
  each renewer applies its own window and the validator duplicates none of it.
- It costs one external view call on a contract the rule already calls for the
  price.
- Confirmed on the fork, 2026-10-22: `isRenewable("test")` is true,
  `isRenewable("hello")` is false, and `getRenewPrice("hello", ...)` reverts
  `0x1caefaa0`, which is `NameNotRenewable`.

**Consequence**

1. Order inside `_checkRenewCall`: owner binding, then duration and token,
   then renewability, then price. A lapsed name whose `latestOwner` still reads
   as the session owner passes the binding and is then refused by the
   renewability check with the clear error, which was the exposure.
2. T2, T6 and T9 assert against these errors. A name held by another party is
   still renewable, so the binding refuses it first with `PolicyRuleFailed`. A
   name past grace gave `RenewalTargetNotRenewable` until the reversal below;
   it now gives the registrar's `NameNotRenewable`.
3. `ERD.md` 6.4 no longer carries a single spend figure. It carries the
   per-session model and the measured spread.

### Reversal of point 3

**Date:** 2026-10-28
**Status:** REVERSED by the operator, C12

Point 3 is withdrawn. The rule no longer calls `isRenewable` before the price
call, and the `RenewalTargetNotRenewable` error is deleted. A target that will
not renew the name is still refused; the refusal now carries the registrar's
`NameNotRenewable`.

**Why**

Size. The check cost 210 bytes of a contract that had 2,059 bytes of EIP-170
headroom left. Measured at ENS's own `optimizer_runs = 23000`, removing it took
the validator from 22,517 to 22,307 bytes and the spare from 2,059 to 2,269.
C11 has the full attribution.

The check removed nothing that is enforced. Read at HEAD `3e54cdb8`:
`AbstractETHRegistrar.getRenewPrice` (line 109) calls `_requireRenewable`
(line 156), which runs the SAME
`_isRenewable(ETH_REGISTRY.getState(LibLabel.id(label)))` predicate as
`isRenewable` (line 88) and reverts `NameNotRenewable`. Same contract, same
predicate, same block, same call. Any label our pre-check refused, the price
call refuses too. Only the surfaced error changed.

**What we gave up, stated plainly**

We no longer own that check. We now depend on `getRenewPrice` continuing to
call `_requireRenewable`. If ENS ever changed `getRenewPrice` so that it
prices a name without testing renewability, our rule would silently stop
checking renewability. Nothing would fail loudly; T9 would still pass, because
it asserts the registrar's error and the registrar would simply no longer
raise it.

The blast radius of that is bounded, and it is worth being precise about why.
A renewal of a non-renewable name does not move value to an attacker: the
money legs still require an exact match to the quoted price, the target must
still hold `ROLE_RENEW`, and the name must still bind to the owner. The
failure mode is a wasted transaction, paid by the owner, against a name that
cannot be extended. It is not a security hole. It is a diagnostics and
gas-waste regression.

We accept it for 210 bytes because headroom in this contract is the objection
a reviewer is most likely to raise, and because the dependency is on one line
in the same repository, visible to anyone reading the renewer.

---

## D8. The renew path gets its own approve check

**Date:** 2026-10-22
**Status:** DECIDED by the owner

**Decision**

Give the renew path its own approve check. Leave `_checkPaymentTokenApproval`
untouched. `register` and `commit` keep using it unchanged.

The renew-path approve check requires three things:

1. The spender holds `ROLE_RENEW` at the registry root.
2. The spender is the same registrar that the renew call in that batch targets.
3. The amount equals the exact quoted price. Not a maximum. Exact.

**Reason**

This repeats the D5 precedent. There, renew got its own authority check instead
of a change to `_isAuthorizedRegistrar`. The same applies here.

Option (a), extending `_checkPaymentTokenApproval`, is the smaller diff. It
also modifies a rule that `register` and `commit` depend on, which forces a
reviewer to re-verify both paths. "We added one rule and altered none" is the
proposal, and that is worth more than a shorter diff.

**Consequence, and one of these is new**

1. The check is cross-execution. The approve can appear before the renew in the
   batch, so the price is not known when the approve is read. The validator
   must collect the renew target, the price, the approve spender and the
   approve amount through the loop, then compare them after it. The existing
   `FundingPolicyState` already uses that shape: it records `permitted` and
   `transferred` and tests them after the loop.
2. **The `transferFrom` leg needs its own check too.** This was not obvious
   before reading `_checkFundingCall`.
   That function already enforces the shape D6 wants for the pull: source is
   `state.owner`, destination is `state.account`, and the amount matches. But
   it reaches that code only through a `permit` first. It reverts when
   `!state.permitted`, and it requires the transfer to sit at
   `permitIndex + 1`.
   D6's model has no permit. The owner granted a standing ERC-20 allowance, so
   the batch starts at `transferFrom`. A D6 batch therefore fails the existing
   funding branch. It can also miss that branch altogether, because the branch
   only runs when `fundingToken != address(0)`, and `fundingToken` is
   `proof.refundToken`, which a renew session need not set. Then the
   `transferFrom` falls through the chain to `ActionNotAllowed`.
   So the renew path needs its own `transferFrom` check as well: source the
   owner's wallet, destination the HCA, amount equal to the exact price. This
   follows the same reasoning the owner gave for the approve check and alters
   no existing rule. Flagged rather than assumed; say so if the intent was
   different.
3. The three D6 batch-shape checks all land in this cross-execution state, so
   they are one piece of work, not three.

## D9. Default values for D4's two caps

**Date:** 2026-10-27
**Status:** DECIDED by the owner

**Decision**

D4 decided the shape (fix the duration, cap the spend); this fills in the two
numbers, which D4 left open and which `STATE.md`'s "Open decisions" and
`THREAT-MODEL.md` section 8 were waiting on.

- Fixed renewal duration: `31557600` seconds. Matches `RENEWAL_DURATION` in
  `contracts-v2/contracts/test/unit/hca/AutoRenewPolicy.t.sol` line 95,
  confirmed by direct grep against the test file, not taken on the owner's
  word alone.
- Maximum spend per session: 2x the live `getRenewPrice` quote for the demo
  name, read at install time and recorded next to the quote (not a fixed
  number here, because the quote is per-name and read at install, per D4's
  own reasoning that "the spend cannot \[be fixed\], because the oracle
  price moves between install and execution").

**Reason**

Given by the owner: not independently re-derived here.

**Evidence**

`RENEWAL_DURATION = 31557600` read directly from
`contracts-v2/contracts/test/unit/hca/AutoRenewPolicy.t.sol:95`, 2026-10-27.
The max-spend multiplier and its "read at install, recorded next to the
quote" rule are the owner's decision, recorded verbatim; the quote itself is
produced and recorded when `progress/evidence.md` E6.5 creates the demo
account.

## D10. The HCA account never owns the name; the EOA does

**Date:** 2026-10-27
**Status:** DECIDED by the owner, confirmed on chain

**Decision**

The registry-owner of a name under this project's auto-renew design is
always the human EOA, never the HCA account itself. The HCA account is an
authorized caller: it calls `renew()`, funded from the owner's wallet, but
it is not and cannot be the name's registered owner. This is not a new
rule chosen here — it is what D6 and D8 already modeled (`FundingPolicyState`
pulling from `state.owner`, not from the HCA), and what `ERD.md` section
3.3 and the passing test matrix (`progress/contracts.md` C1) already
assume. D10 exists because the assumption now has an on-chain reason, not
just a design one.

**Reason**

`StandaloneSingleOwnerHCA._fallback` (`src/hca/StandaloneSingleOwnerHCA.sol`
lines 342-358) unconditionally rejects every `onERC721Received`,
`onERC1155Received` and `onERC1155BatchReceived` selector, reverting
`NoNFTAllowed`, before forwarding anything else to Nexus. `ETHRegistry`'s
registration path invokes that hook on the recipient it mints to. So an HCA
of this implementation can never pass a safe-mint or safe-transfer to
itself — structurally, not by configuration, not by a missing approval.
Confirmed live, not just read: trying to register a name directly to the
HCA account reverted with selector `0x6e29a697` (`NoNFTAllowed`) on
Sepolia. Registering to the account's owner EOA instead, with the HCA bound
to that EOA as its session, succeeded.

**Evidence**

- `src/hca/StandaloneSingleOwnerHCA.sol:97` declares `error NoNFTAllowed()`;
  lines 342-358 throw it for all three receiver selectors.
- Live revert, Sepolia, 2026-10-27: `register("autorenewdemo",
  0xe4F6BBcf33656d55Cc50Cf2FAD344C208243031F, ...)` → `0x6e29a697`.
- Live success, same beat: `register("autorenewdemo",
  0x41baA860cf727eAbbbE5f469E0cF5A0833148F31, ...)` → tx
  `0xd8d7a0b183f82c4bc2e1bdb9ccc03b974f09f917b205ae0159c86e98ef21ee66`,
  confirmed, `isAvailable("autorenewdemo")` re-read as `false` afterward.
- `progress/evidence.md` E6.5 has the full sequence, including the first
  commitment (owner = the HCA account) that was never consumed because the
  register call reverted before completing.

## D11. The renew caps ride in spare bits of the existing salt words

**Decision**

The session salt keeps SEVEN fields. The three renew caps do not take words
of their own. Each cap sits in spare high bits of a word the salt already
hashes.

```
word 1  sessionNonce          bits 0-95    renewPaymentToken  bits 96-255
word 6  maxRefundGasOverhead  bits 0-47    renewalDuration    bits 48-111
        maxRenewSpend         bits 112-207
```

**Why**

A ten-field salt changes the derived `permissionId` for every session, even a
session whose three renew fields are all zero. That invalidates an
authorization the owner already signed. C9 measured the two salts and they
differ. C10 then found the affected population cannot be counted, so the cost
could not even be bounded.

Packing removes the cost instead of measuring it. Zero sets no bit, so a
session that does not enable auto-renew hashes the same seven words the
pristine validator hashed and derives the same `permissionId`. An owner who
signed before this rule shipped keeps that signature.

**What it costs**

31 bytes. Packing is the dearest of the three options by size: the
shift-and-or arithmetic costs more code than three extra memory writes. The
salt is only 55 bytes of the rule's 2,733, so this was never a size lever.
It is a compatibility lever. See C11 for the full attribution.

**Why it does not weaken the commitment**

The packing is lossless and the map from field set to word is a bijection.
Checked at every type maximum: word 1 fills exactly 256 bits, word 6 uses 208
of 256, every field round-trips, and no bit range overlaps. The salt
therefore commits to the renew caps exactly as strongly as three separate
words commit to them. No two different cap sets can produce the same salt.

**Evidence**

- `src/hca/HCAOwnerAndSessionValidator.sol`, `_sessionAuthorizationSalt`.
- The pristine seven-field encoding and the packed encoding with zero caps
  both hash to
  `0x7856f260a92b146920cb22aa148245aded22a4f59a2efd2f065901caf91d988c`, and
  the two encodings compare equal byte for byte (`cast abi-encode`).
- The salt hunk in the pre-existing `HCAOwnerAndSessionValidator.t.sol` was
  reverted to its HEAD form and all 134 tests in `test/unit/hca/` still pass.
  Those are the sixteen tests R3 broke.
- `operator/session.ts` `sessionSalt` mirrors the packing;
  `operator/session.vector.test.ts` passes 9 of 9 on byte equality.

**Consequence for the ask**

A user with a live session no longer has to re-sign it. THREAT-MODEL.md does
not carry that claim and needs no change. The C10 proposal paragraph in
`progress/contracts.md` does carry it and is now stale; it is written to be
pasted into the ask, so correct it before the ask goes out. The header growth from 110 to 150 bytes remains, but the owner
signs over the salt and not over the envelope, so that is a re-packing cost
for our own operator software, not a user-visible one.
