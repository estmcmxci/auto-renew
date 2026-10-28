# Demo script

The sequence on screen, in order. The frontend agent builds to this.

Read `ERD.md` section 8 for the layout. Every line in the right pane comes from
a contract event or a call result. Nothing in this script is narrated by the
frontend.

## Setting

One page. Two panes. Two controls.

- Left pane: the product. The name, the expiry, a countdown, the auto-renew
  switch, the funding source, the balance, the fallback address.
- Right pane: the proof. The session, both caps, the budget that remains, and a
  log of every attempt.
- Controls: a time scrubber, and a button that empties the funding source.

Name for the demo: use a name the demo account holds. A second name, held by
somebody else, is needed for beat 3.

## Beat 1. Setup

**Action:** The operator signs twice and selects a fallback address.

**Left pane:** The name appears. Auto-renew turns on. The fallback address
appears. Expiry shows the real date, with a countdown.

**Right pane:**

```
session   0x7a3f…c2      valid until <date>
limits    max 1 year per renewal · max 25 USDC per year
budget    25.00 of 25.00 remaining
```

**What to say:** two signatures, no transaction, no ETH for gas.

## Beat 2. The renewal fires

**Action:** Move the time scrubber forward. Do not touch anything else.

**Left pane:** The countdown falls. At the trigger window the status changes to
renewing, then to a new expiry one year later.

**Right pane:**

```
✓ renew  <name>  1 year   5.00 USDC
  owner matches · within duration cap · within spend cap
budget   20.00 of 25.00 remaining
```

**What to say:** nobody touched it. This is the whole product.

This beat is what a decision maker remembers. Let it run without commentary.

## Beat 3. The key reaches for a name it does not own

**Action:** Make the session key attempt a renewal of a name held by another
account.

**Left pane:** No change. Nothing happened to the user.

**Right pane:**

```
✗ renew  <other-name>  1 year
  rejected · latestOwner does not match the session owner
```

**What to say:** this is the request. A key that renews your name and nothing
else.

## Beat 4. The key asks for too much

**Action:** Make the session key attempt a renewal above the duration cap.

**Right pane:**

```
✗ renew  <name>  50 years
  rejected · duration above the cap
```

Repeat for the spend cap if the budget allows a clean demonstration.

**What to say:** a stolen key costs the remaining budget, for the capped
duration, on names you already hold. One transaction ends the session.

## Beat 5. The money runs out

**Action:** Press the drain control. Move time forward again.

**Left pane:** The balance reads zero. The renewal does not happen. The name
address record changes to the fallback address. The status says the name now
resolves to the fallback.

**Right pane:**

```
✗ renew  <name>  1 year
  rejected · funding source empty
✓ setAddress  <name>  0xBACK…9f
  permitted by the existing policy · no change requested
```

**What to say:** payments now go to an address you control, not to a wallet you
cannot reach. This half needs nothing from ENS. It already works.

## Beat 6. Close

Show the grace window on the left pane. The name is still renewable, by the
owner or by anybody.

Then state the request in one line: permit `renew` in the session policy, bound
to the owner, with two caps. One rule in one contract.

## What must not appear

- A log line the contract did not produce.
- A success beat with no matching rejection beat.
- Any claim about the blast radius that is not a number.
