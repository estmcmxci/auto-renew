# Auto-renew: engineering requirements

Build specification. Written 2026-10-22. Read `PRD.md` first.

## 1. Summary

Add one rule to `HCAOwnerAndSessionValidator`. The rule permits `renew` when
the call names a name that the owner holds, within two caps.

Build a demo that proves the rule. The demo runs on Sepolia, where ENSv2 is
live, and on a local fork of Sepolia where the clock can move.

ENSv2 mainnet goes live in about a month. Mainnet runs the same contracts as
Sepolia: every constant read on 2026-10-22 was identical on both. So go-live is
a chain-id change. See `config/README.md`.

## 2. Repository

Clone `ensdomains/contracts-v2`. Use branch `post-audit-2`. This is the base of
PR #465, the mainnet deployment branch.

Do not open a pull request into #465. It is a draft deployment record and it
states "Do not merge before then".

Toolchain: Bun and Foundry. Both versions are pinned in the repository.

## 3. The contract change

### 3.1 Location

`contracts/src/hca/HCAOwnerAndSessionValidator.sol`. The policy is a chain of
`if` statements on the target and the selector. The chain is near line 660.

### 3.2 The new rule

Add a case for `IETHRenewer.renew.selector`.

Check the authority with a role query. Call
`_isAuthorizedRenewer(execution.target)`. It requires the target to hold
`ROLE_RENEW` at the registry root.

Do not call `_isAuthorizedRegistrar` for the renew case. That function checks
`ROLE_REGISTRAR`. The registry gates renewal with `ROLE_RENEW`, so
`ROLE_REGISTRAR` asks a different question. `ETHRenewerV1` holds `ROLE_RENEW`
and does not hold `ROLE_REGISTRAR`, so a `ROLE_REGISTRAR` check refuses every
renewal through it. This was verified on chain. See `DECISIONS.md` D5.

Keep the symmetry. The register case checks the role that registration needs.
The renew case checks the role that renewal needs. Leave the commit case and
the register case unchanged.

Do not hardcode a renewer address. The validator pins the registry, not a
registrar deployment, so that a registrar replacement does not break live
sessions. A registrar replacement is in progress in the live run. A role query
survives a redeploy of either contract.

`_isAuthorizedRenewer` proves that a target may renew. It does not prove that
the target is correct for the name. See section 3.3.

### 3.3 Registrar selection

A name can hold a reservation on v2 and still live on v1. The two states need
different registrars.

- A v1 name renews through `ETHRenewerV1`.
- A v2 name renews through `ETHRegistrar`.

On Sepolia, ENSv2 is live, so the demo registers natively and renews through
`ETHRegistrar`. The demo does not exercise the migration path.

On mainnet before go-live, the opposite holds. Native registration is not open,
so a premigrated name renews through `ETHRenewerV1`. After go-live, mainnet
behaves like Sepolia.

So the operator must establish which registry holds the name before it builds
the call. Do not assume one registrar, and do not assume the Sepolia answer
transfers to mainnet before go-live.

The validator cannot make this choice. It can only reject a target that does
not hold `ROLE_RENEW` at the registry root. Both `ETHRenewerV1` and
`ETHRegistrar` hold that role, so the validator admits both. Selection is
operator logic, and test 9 covers the failure case.

Bind the name to the owner. Read the label from the call data. Compute
`LibLabel.id(label)`. Read the owner from the registry.

Read `latestOwner` from `getState(LibLabel.id(label))`. Do NOT call
`latestOwnerOf`, and do not call `ownerOf`.

`latestOwnerOf` needs the versioned token id. The validator holds a label, so
it would read the zero address and refuse every renewal. `getState` accepts a
labelhash and rebuilds the versioned id. `VERIFY.md` item 4 holds the
measurement.

Record the reason in the code and in the proposal:

- During the grace period, the name is expired but `latestOwner` is still the
  owner. The session must work in this window, because this is the window that
  matters.
- After a third party registers the name, `latestOwner` becomes that third
  party. The old session key then fails the binding. The rule corrects itself.
- `ownerOf` fails during the grace period and defeats the purpose.

### 3.4 The caps

Add three fields to the session data:

- `renewalDuration`, in seconds. A FIXED value, not a maximum. The call must
  match it exactly. See `DECISIONS.md` D4.
- `renewPaymentToken`. One fixed token. `renew` takes the token as a
  parameter, so a cap in one token does not bind a call that pays in another.
- `maxRenewSpend`, in the payment token. A bound on ONE call.

Reject a call with a duration that does not equal `renewalDuration`. Reject a
call that pays in another token. Reject a call that costs more than
`maxRenewSpend`.

#### How the period cap works

The period cap is NOT in this contract. It is the owner's ERC-20 allowance.

No funds park in the HCA. The money comes from the owner's wallet, up to the
allowance the owner granted, and passes through the HCA in one atomic batch:

1. `paymentToken.transferFrom(wallet -> HCA, exact quoted price)`
2. `paymentToken.approve(registrar, exact quoted price)`
3. `registrar.renew(...)`

The HCA balance is zero before the batch and zero after it.

The allowance is stateful. The token contract decrements it on every
`transferFrom`. So the token enforces the period cap for free. This validator
is stateless, so it cannot hold a period total. Do not build period
accounting. Do not add storage. See `DECISIONS.md` D6.

The validator checks the shape of the batch instead:

- The batch pulls the exact quoted price. No over-funding, and no residue in
  the HCA. The registration route over-funds on purpose and leaves the
  remainder. Renewal must not copy that.
- Any approve goes to the selected registrar, for that same exact amount.
- The `transferFrom` source is the owner's wallet. The destination is the HCA.

### 3.4.1 A note on authority

Two different statements are both true. State them separately.

- The registry gates renewal with `ROLE_RENEW`. The registrar holds that role.
  `roles.md` records `ETHRenewerV1` with registry-wide `RENEW`.
- The registrar's external `renew()` takes no caller check. It pulls payment
  from `msg.sender`. So any account can call it and pay for it.

The second statement is why a session key or a keeper can renew at all. The
first is why the registrar, not the caller, is the privileged party. Do not
write "renewal is permissionless" without this distinction. A reviewer will
read it as a claim about the registry and reject it.

`HCAFundingSessionValidator` holds the same pattern on the source side. Follow
it.

### 3.4.2 Fixed values or maxima

Decide this before you build the caps.

Rhinestone's `SchedulingBase` uses fixed values, not maxima. The amount is set
in `executionData` at install. The schedule is a fixed interval with a fixed
execution count. The caller chooses nothing.

A maximum leaves a stolen key room to choose. A fixed value leaves it none. A
session that renews for exactly one year, once per interval, is tighter than a
session that renews for up to one year.

The cost of fixed values is that the owner cannot vary a renewal without a new
authorization. For a yearly renewal that cost is low.

Recommended: fix the duration, cap the spend. The price moves with the oracle,
so the spend cannot be a fixed value. The duration can.

Record the choice in `DECISIONS.md` and justify both numbers in
`THREAT-MODEL.md` section 8.

### 3.5 What must not change

- The initial implementation. It is part of the account address derivation. A
  new initial implementation moves every new account address.
- The existing rules. Add a case. Do not alter the others.
- `HCAResolverPolicyLib`. The fallback write needs no change. See section 5.

## 4. Test matrix

These tests are the proposal. The demo renders the same list.

| # | Case | Expected |
| --- | --- | --- |
| 1 | Session key renews a name the owner holds | Pass |
| 2 | Session key renews a name the owner does not hold | Revert |
| 3 | Duration above the cap | Revert |
| 4 | Spend above the period cap | Revert |
| 5 | Name is expired, inside grace, owner unchanged | Pass |
| 6 | Third party registers the name, old key retries | Revert |
| 7 | Renewal through an unauthorized registrar | Revert |
| 8 | `revokeSessions()` then any renewal | Revert |
| 9 | A v1 name renewed through the wrong registrar | Revert |

Run tests 1 to 9 on a fork of Sepolia, against the deployed contracts. Use
`vm.warp` for the expiry cases.

Run them again on a fork of mainnet before the proposal. The constants match,
so a difference means something moved and the proposal is reading stale state.

Test 6 is the strongest test. It proves that the binding does not grant a
permanent right to a name after the owner loses it.

## 5. The fallback path

This path needs no contract change.

`HCAResolverPolicyLib._isRecordSelector` already permits
`IAddressSetter.setAddress`. The record setters check the selector and the
binding. They do not check the value. So the session can already write any
address into the name address record.

The fallback is therefore operator logic. The operator detects a failed
renewal and writes the fallback address.

State this in the proposal. It reduces the request to one rule.

Open item: confirm the API to grant one named resolver role to one delegate
contract. A standalone fallback contract needs it. A session-driven fallback
does not.

## 6. Environments

Addresses come from `config/networks.ts`. Do not write one into any other
file. Run `preflight` before every run. It stops the run when the chain
disagrees with the config.

### 6.1 Sepolia, the primary environment

ENSv2 is live on Sepolia. So the demo runs the real `ETHRegistrar` path, not
the `ETHRenewerV1` migration path, and nothing has to be forced open.

Deploy a private HCA stack with `contracts/deploy/hca`. Approve the modified
implementation in your own factory. Request nothing from ENS.

Record the transaction hashes for setup and for one renewal. These are the
public evidence, and they are real transactions against live v2.

Use a new deployer key. Do not use `0x1C2F…fF21`, which is compromised. Do not
use the `estmcmxci.eth` owner key.

### 6.2 Fork of Sepolia, for the clock

`anvil --fork-url $SEPOLIA_RPC_URL`, the dedicated provider, never the
keyless read endpoint. The fork holds every deployed ENSv2
contract at its real address. State is fetched when a call touches it. Start
time is seconds. A fork keeps the forked chain's id, so `getNetwork(11155111)`
resolves correctly.

Deploy the modified validator onto the fork, beside the real contracts.

Move time with `evm_increaseTime` and `evm_mine`. A full name life compresses
into seconds.

The frontend points at the fork's actual port. Do not assume `8545`: confirm
it first. `progress/contracts.md` S2 found an unrelated anvil already
holding `8545` on the development machine, with this project's fork on
`8546` instead.

This is where the demo runs, because a public chain cannot be fast-forwarded.
Sepolia carries the evidence; the fork carries the clock.

### 6.3 Mainnet

Read-only until go-live. Fork it to re-run the test matrix before the proposal.
Deploy nothing.

### 6.4 Payment token

Renewal is denominated in ERC-20. The accepted set is read from the rent
oracle and asserted by `preflight`, never assumed.

Sepolia accepts three tokens: `MockUSDC` and `MockDAI`, both ENS-deployed, and
Circle's Sepolia USDC. The last is faucetable, so the demo can fund itself
without mint rights on the mocks. Mainnet accepts USDC and DAI.

The oracle has no enumeration method, so the set can only be probed. Treat it
as open, not as a complete list.

Do NOT ground the spend cap on one figure. The price depends on name length.

Measured on 2026-10-22 with `getRenewPrice(label, duration, token)`:

| Name | Characters | One year, MockUSDC |
| --- | --- | --- |
| a nine-character name | 9 | 8.0055 |
| `test` | 4 | 160.000009 |

That is about a twentyfold spread. A cap taken from a nine-character name
refuses a four-character name. A cap taken from a four-character name barely
bounds a nine-character one.

So `maxRenewSpend` is set PER SESSION, when the session is created, from
`getRenewPrice` for the name that session renews, plus headroom for oracle
drift. Do not put a single figure in the contract or in `config/`. See
`DECISIONS.md` D7.

## 7. Backend

### 7.1 The operator

The operator watches the expiry and submits the call. It holds the session key.

Local demo: a Node process beside the fork. A Cloudflare Worker cannot reach
`localhost`.

Sepolia: a Cloudflare Worker on a cron trigger.

Write the logic once as a shared TypeScript core. Give each runtime a thin
entry point. Do not fork the logic. See `DECISIONS.md` D3.

Both read the expiry directly from the registry. An indexer is not required at
this scale. `ensdomains/bigname` is the read layer if this ever runs at volume.

### 7.2 Operator logic

1. Read the expiry for each watched name.
2. If the expiry is inside the trigger window, build the renewal.
3. Submit it with the session key.
4. On a funding failure, write the fallback address.
5. Record every attempt and its result for the frontend.

Renewal is additive. `renew` adds the duration to the existing expiry, so an
early call wastes nothing. Trigger early and retry.

### 7.3 Relaying

Use `rhinestonewtf/mockestrator` to run the relayed session flow locally.
`contracts/deploy/hca/00_MockRegistrationIntentExecutor.ts` exists for the same
reason.

Do not depend on the live Rhinestone router for the demo. It puts a third party
on the critical path and the demo must repeat on command.

Rhinestone does ship scheduled execution: `ScheduledOrders` and
`ScheduledTransfers` in `rhinestonewtf/core-modules`. Neither helps here, for
two reasons. The catalog has no scheduler for an arbitrary call, and
`executeOrder` is account-gated, so their automation submits a user operation
from the account and still passes through the validator.

Cite those modules as precedent for the shape. Do not cite them as a service
that will fire your renewal. See `DECISIONS.md` D1.

## 8. Frontend

Stack: Vite, React, wagmi and viem, with `@ensdomains/thorin`. See
`DECISIONS.md` D2. Pin viem at 2.35.0 or above, or v2 resolution reads the
wrong values.

One page. Two panes. Two controls.

### 8.1 Left pane, product

Name, expiry date, countdown, auto-renew switch, funding source, balance,
fallback address, status line.

Use the ENS design system, so the pane reads as the shipped feature.

### 8.2 Right pane, proof

Session key and session expiry. Both caps. Budget remaining. A log of every
attempt with the result and the reason.

Each log entry must come from a contract event or a call result. Do not write
any entry from the frontend state.

### 8.3 Controls

- Time. Moves the fork clock. Drives the countdown and triggers the operator.
- Drain. Empties the funding source and forces the fallback path.

### 8.4 Setup flow

Build it, simplified. Show two signatures, no transaction and no ETH for gas.
Show the fallback address selection.

## 9. Build sequence

1. Write the rule and tests 1 to 9 on a Sepolia fork. Nothing else.
2. Stand up the local fork and the operator process.
3. Build the two panes against the operator log.
4. Build the setup flow.
5. Deploy the private stack to Sepolia and record the evidence transactions.
6. Write the threat model.

Step 1 is the whole contested claim. Do not start step 3 before step 1 passes.

## 10. Acceptance

- All nine tests pass on a fork of Sepolia, and again on a fork of mainnet.
- The demo runs a full cycle with no manual call: time moves, the name renews.
- The demo shows two rejections, read from the contract.
- The demo shows the fallback write after a funding failure.
- Sepolia transaction hashes exist for setup and for one renewal.
- A reader who does not read Solidity can state the blast radius of a stolen
  session key.

## 11. To verify

These are unconfirmed. Confirm each before it enters the proposal.

1. The minimum registration duration in v2. It decides whether Sepolia can show
   an expiry cycle.
2. The grace period in the live deployment. It is a constructor argument.
3. The resolver role-grant API for a delegate contract.
4. The exact registry accessor available to the validator. `latestOwnerOf` and
   `getState` both exist on `IPermissionedRegistry`.

## 12. Reference

Addresses live in `config/networks.ts`, for both networks, with their
provenance. This document does not repeat them, and neither should any other
file.

Note the two sets come from different branches. The Sepolia records are on
`post-audit-2`. The mainnet records exist only on the deployment branch
`deploy/mainnet-v2-20261002` and are not merged.

Governance: the `APPROVE` roles on `HCAUpgradeSet` belong to
`0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7`, the ENS DAO timelock. Not the
Security Council Safe. A production change therefore needs an executable DAO
proposal, and each account owner starts their own upgrade afterwards.

`StandaloneHCAImplementation` has no owner. A change means a new implementation,
approved into the sets.

Source files:

- `contracts/src/hca/HCAOwnerAndSessionValidator.sol`
- `contracts/src/hca/HCAFundingSessionValidator.sol`
- `contracts/src/hca/libraries/HCAResolverPolicyLib.sol`
- `contracts/src/hca/libraries/HCARegistrarPolicyLib.sol`
- `contracts/src/registrar/AbstractETHRegistrar.sol`
- `contracts/src/registry/interfaces/IPermissionedRegistry.sol`
- `docs/HCA.md`
