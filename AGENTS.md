# Working rules for this project

Read `PRD.md`, then `ERD.md`. Do not start work before both.

The `ensv2` skill in `.claude/skills/ensv2/` holds the domain knowledge. Load
it before you read or write any ENSv2 contract. This file does not repeat it.

## What this project is

One rule added to the ENSv2 HCA session policy, and a demo that proves the rule
is safe. Nothing else.

The request is small on purpose. Do not grow it.

## Hard rules

1. **Never open a pull request into `ensdomains/contracts-v2` PR #465.** It is a
   draft mainnet deployment record. Its body says "Do not merge before then".
2. **Never use the key `0x1C2F…fF21`.** It is compromised. Sweepers are live on
   mainnet, Base, Optimism and Arbitrum.
3. **Never use the `estmcmxci.eth` owner key for project operations.** Generate
   a new deployer key.
4. **Never write a log entry in the demo frontend from frontend state.** Every
   entry must come from a contract event or a call result. A faked rejection
   makes the whole demo worthless.
5. **Do not start the frontend before the test matrix passes.** Section 9 of
   `ERD.md` gives the build order. Step 1 is the entire contested claim.

## Verification

Verify against deployed contracts, never against a local ABI.

Pin the commit you read. Do not cite a moving branch. The vendored copies in
`reference/` carry their commit; treat them as a snapshot, not as truth.

Addresses are perishable. The mainnet contracts were replaced twice in October
2026. Re-read before you rely on one.

`VERIFY.md` lists what is still unconfirmed. Each item has a method. Clear an
item before it enters a proposal, and record the evidence in that file.

## Writing

Technical documents use Simplified Technical English (ASD-STE100). Short
sentences. Active voice. One instruction per sentence. One word, one meaning.

This applies to `PRD.md`, `ERD.md`, `THREAT-MODEL.md`, any runbook, and any
text that goes to the ENS forum.

It does not apply to chat.

## Reporting

For a finding, give the path and the exact symbol or line, and name the commit
you read it at. Put a testnet limit next to the claim it affects.

State what you observed, the authority path, the class of evidence, and what
is still open. Do not prescribe a remedy unless asked.

If you cannot verify a claim, mark it unverified. Do not round it up.
