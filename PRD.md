# Auto-renew for ENS names

Product requirements. Written 2026-10-22.

## 1. Summary

An ENS name expires. If the owner does not renew it, a third party can register
it. Payments to the name then go to the new owner.

This product renews the name without the owner. The owner authorizes the
renewal one time at setup. If the funds are not available, the name points to a
fallback address that the owner selected.

The goal is the auto-renew feature in the ENS app. The deliverable in this
document is a demo. The demo supports one request to ENS.

## 2. The problem

ENS names expire after a fixed term. Owners forget to renew them.

The failure is quiet. The name continues to resolve to the owner address
through the grace period. The owner sees no error. When a third party registers
the name, payments to that name go to the third party.

Two different users have this problem:

- The user forgot. Payment for ten years at setup solves this case.
- The user cannot renew. The wallet is lost, empty or compromised. Payment in
  advance does not solve this case. The name continues to send payments to a
  dead address until the name expires.

The second case is the reason for this product.

## 3. The product

### 3.1 Setup

The user does three things one time:

1. Sign a session authorization.
2. Sign a token permit.
3. Select a fallback address.

The user sends no transaction. The user needs no ETH for gas.

### 3.2 Normal operation

The session key calls `renew()` before the name expires. The call pulls the
quoted amount in ERC-20 from the funding source. The name expiry increases.

The user does nothing and receives no prompt.

### 3.3 Failure operation

If the funding source is empty, the session writes the fallback address into
the name address record. Payments to the name then go to an address that the
user controls.

The name remains renewable through the grace period and the premium auction.
Any third party can renew it in that window.

The grace period is not one figure. `ETHRegistrar` on mainnet reports
2,419,200 seconds, which is 28 days. `ETHRenewerV1` reports 7,776,001 seconds,
which is 90 days and one second, because premigration added a bonus period to
the v2 grace. A premigrated v1 name therefore keeps the window its owner
expects. A name registered natively on v2 gets 28 days.

Read 2026-10-22. See `VERIFY.md` item 2.

### 3.4 Limits

The owner always owns the name. The registrar assigns the name to the owner
wallet, not to the session account.

The session policy applies two caps:

- A maximum duration for each renewal.
- A maximum spend for each period.

The owner cancels all sessions with one transaction.

## 4. The request to ENS

ENS must add one rule to the HCA session policy.

The policy permits `commit`, `register`, resolver record changes, primary-name
changes, payment-token approvals and resolver deployment. The policy does not
permit `renew`. The ENS documentation states this as a decision, not as an
omission.

The reason is structural. Every permitted rule binds an address argument in the
call data to the owner. A registration must name the owner as the registrant. A
primary-name change must name the owner.

The `renew` call carries no owner argument. The registry gates renewal through
a role that the registrar holds, not the caller, so the call itself does not
need to say who it is for. Any account can call it and pay for it. The policy
therefore has nothing to compare against the owner.

The request is to bind `renew` by name ownership instead, and to cap it.

## 5. What exists already

These parts are built and deployed. The demo uses them without change.

| Part | State |
| --- | --- |
| Permissionless renewal, paid in ERC-20 | Deployed |
| Session keys with a fixed policy | Deployed |
| Cross-chain funding in stablecoin | Deployed |
| Fallback write (`setAddress` in the policy) | Deployed |
| The operator that watches and submits | The ENS app holds the session key |

Only the binding and the caps are new.

## 6. The demo

### 6.1 Purpose

The demo must do two things at the same time:

- Show a decision maker why the feature matters.
- Show an engineer that the binding is safe.

The second is the request. The first is the reason anybody listens.

### 6.2 Environment

The demo runs on a local copy of mainnet. The real ENS contracts are present at
their real addresses. The clock moves forward on command, so one year of name
life takes seconds.

The demo also includes real transactions on Sepolia. These prove that the
mechanism works on a public chain.

### 6.3 Screen

One screen, two panes, two controls.

The left pane is the product. It shows the name, the expiry, a countdown, the
auto-renew switch, the funding source, the balance and the fallback address.
Nobody touches this pane during the demo.

The right pane is the proof. It shows the session, the two caps, the budget
that remains, and every call that the session key attempted. Each entry states
the result and the reason.

The two controls are time and money. Time moves the clock forward. Money empties
the funding source.

The right pane must read the real result from the contract. A scripted result
makes the demo worthless.

### 6.4 Sequence

1. Setup. The user signs twice and selects a fallback address. No transaction.
2. Time moves forward. The countdown falls. The renewal fires. The left pane
   shows a new expiry. The right pane records the accepted call and the spend.
3. The session key attempts a name that the owner does not hold. The contract
   rejects it.
4. The session key attempts a duration above the cap. The contract rejects it.
5. Money is removed. Time moves forward. The renewal fails. The fallback write
   fires. The left pane shows the name at the fallback address.

Step 2 is the beat that a decision maker remembers. Steps 3 and 4 are the
request.

## 7. Success

The demo succeeds if a person who does not read Solidity can state what a
stolen session key can and cannot do.

The answer must be a number: a stolen key costs at most the remaining budget,
for at most the capped duration, only on names that the owner already holds,
and one transaction ends it.

## 8. Out of scope

- A business or a paid service.
- An ENSIP. This is a contract policy change, not an interoperability standard.
- A change to how renewal is priced or paid.
- Any change that requires a new initial implementation. The change must deploy
  as an in-place upgrade, so that account addresses do not move.

## 9. Open questions

1. Does ENSv2 set a minimum registration duration? If it does, the Sepolia
   evidence cannot show a full expiry cycle. Only the local demo can.
2. What is the grace period in the live v2 deployment? It is a constructor
   argument, not a constant.
3. What is the API to grant one resolver role to one delegate contract? The
   fallback path depends on it.
