# Threat model

Status: DRAFT. Fill each section from test results, not from reasoning.

This document answers one question: what does a stolen session key cost the
owner? The answer must be a number. A reviewer will ask it first.

Written in Simplified Technical English.

## 1. The capability granted

State exactly what the new rule permits. One sentence for each permission.

- The session key can call `renew` on a registrar the registry authorizes.
- The call must name a name whose `latestOwner` is the session owner.
- The duration must be at or below the duration cap.
- The spend must be at or below the remaining period budget.

## 2. The attacker

Assume the session key is fully compromised. The attacker holds the key and can
submit any call the policy permits, at any time, until the session expires.

Assume the attacker does not hold the owner wallet. A compromised owner wallet
is out of scope. It defeats every design, including no auto-renew at all.

## 3. Blast radius

Filled from test results on 2026-10-22. All nine tests pass on a fork of
Sepolia against the deployed contracts.

| Question | Answer | Test |
| --- | --- | --- |
| Maximum value the attacker can move | The owner's remaining ERC-20 allowance | 4 |
| Maximum value in ONE call | The session spend cap. 8.806051 USDC in the test | 4 |
| Where that value goes | To the ENS beneficiary, as a renewal payment | 1 |
| Names the attacker can affect | Only names the owner holds when the call runs | 2 |
| Names the attacker cannot affect | Every other name, including one the owner has lost | 2, 6 |
| Can the attacker transfer a name | No. Reasoned, not measured. See below | - |
| Can the attacker change a resolver | No. Reasoned, not measured. See below | - |
| Can the attacker take ownership | No. A renewal extends the expiry and writes no owner | 1, 6 |
| How the owner stops it | `revokeSessions()`. One transaction, owner only | 8 |
| Time to stop it | Immediate. The next validation fails | 8 |

### 3.1 Two different bounds

State both. They are not the same number.

- The PER-CALL bound is the session spend cap. The rule reads the live quote
  and refuses a call above the cap. Test 4 refused 160.109598 USDC against a
  cap of 8.806051 USDC.
- The PERIOD bound is the owner's remaining ERC-20 allowance. It is not in
  this contract. The token contract holds it and decrements it on every
  transfer, so it bounds the total without any accounting in the validator.
  See `DECISIONS.md` D6.

Do not quote the per-call cap as the blast radius. A stolen key can make more
than one call. The allowance is what ends it.

### 3.2 Why a stolen key cannot renew for dust

`MIN_RENEW_DURATION` is 1 second on both the registrar and the renewer,
confirmed on chain, and a one-second renewal costs 6 units of USDC. A spend
cap alone would therefore permit very many near-free calls.

The duration is a FIXED value, not a maximum, so any duration that is not
exactly one year is refused. Test 3 refused one second and one year plus one
second. The exact match is what closes this, not the cap.

### 3.3 Two rows that are reasoned, not measured

Be honest about these in the proposal.

No test drives a transfer or a resolver write through a renew session. The
answers above come from reading the policy, not from a result:

- The if-chain ends in `revert ActionNotAllowed`, so any target and selector
  pair the policy does not name is refused. Test 7 shows that refusal working
  for an unknown target.
- A renew session carries a zero resolver, so the resolver branch, which
  needs a non-zero resolver, is never entered.

Add the two cases to the matrix before the proposal if a reviewer needs them
measured.

The value goes to the ENS beneficiary as a renewal payment. The attacker does
not receive it. State this, because it changes how the risk reads: the attack
wastes the owner's money, it does not steal it.

### 3.4 Why the HCA account can never become the name's owner

This is stronger than "a renewal extends the expiry and writes no owner"
(row above, section 3). It is not just that the renew call happens to leave
ownership alone — the account cannot hold the name at all, by construction.

`StandaloneSingleOwnerHCA` rejects every `onERC721Received`,
`onERC1155Received` and `onERC1155BatchReceived` callback unconditionally,
reverting `NoNFTAllowed`. `ETHRegistry`'s registration path invokes that
hook on whatever address it mints to. Measured, not reasoned: registering a
real Sepolia name directly to an HCA account reverted with that selector;
registering the same name to the account's owner EOA succeeded. See
`DECISIONS.md` D10 and `progress/evidence.md` E6.5 for the transactions.

So the owner/caller split this design relies on (`DECISIONS.md` D6, D8) is
not a policy choice that a future change could loosen. It is a property of
the account contract itself. An attacker who fully compromises the session
key still cannot make the HCA the registry-owner of anything, even if every
other check in this document had a hole.

## 4. What the rule does not grant

List every action the policy still refuses, with the test that proves it.

- Renewal of a name the owner does not hold. Test 2.
- Renewal through an unauthorized registrar. Test 7.
- Renewal after `revokeSessions()`. Test 8.
- Resolver replacement, name transfer, subname creation, registry approval,
  authority grants, calls to arbitrary targets. These are refused by the
  existing policy and are unchanged by this rule.

## 5. The re-registration case

A third party registers a lapsed name. `latestOwner` becomes that third party.
The old session key then fails the binding.

State this plainly. It proves the rule does not grant a permanent right to a
name after the owner loses it. Test 6.

## 6. Comparison

State what an owner risks today without this rule, and with it. Recommend from
the difference, not from the finding.

Without the rule: the owner either renews by hand, or prepays, or the name
lapses and payments route to whoever registers it next.

With the rule: the owner risks the capped budget if the session key is stolen.

## 7. Residual risk

List what remains. Do not round it down.

- The operator must exist and must be running at the trigger time. A silent
  operator failure means no renewal and no fallback write.
- The session has an expiry. If the session expires before the name does, the
  mechanism stops with no signal to the owner.
- The account holds a token balance during an operation. The ENS documentation
  already warns against long-term funds in the account.

## 8. Open

- [x] Fill section 3 from test results. Done 2026-10-22; section 3 says so
      and ledger C2 is closed. Box was left unchecked by mistake.
- [x] Confirm the grace period figure. `VERIFY.md` item 2 is DONE for both
      networks, 2026-10-22, citing registrar 2,419,200s and ETHRenewerV1
      7,776,001s. Box was left unchecked by mistake.
- [x] Decide the default caps and justify each number. `DECISIONS.md` D9,
      2026-10-27: fixed renewal duration 31,557,600s; max spend 2x the live
      `getRenewPrice` quote read at install.
