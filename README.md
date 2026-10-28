# auto-renew

An ENS name can be renewed by anyone — renewal is permissionless. But an ENS
**session key cannot renew**, because `HCAOwnerAndSessionValidator` has no rule
for `renew`. `IETHRenewer.renew` carries no owner argument, so the policy's
`(target, selector)` chain has nothing to bind against and refuses the call.

A session key can `commit`, `register`, `setNameWithHCA`, `claimWithHCA` and
`deployProxy`. It cannot renew the name it was authorised for.

This repository holds the evidence for a one-rule change that closes that gap,
and the operator code built against it.

**The contract change is not here.** It is six files on a branch:
<https://github.com/ensdomains/contracts-v2/compare/post-audit-2...estmcmxci:feat/hca-session-renew-rule>

## It runs on mainnet-equivalent contracts, not in theory

Everything below is on public Sepolia, against the deployed ENSv2 contracts.

| What | Where |
|---|---|
| Patched validator, source verified | [`0x8012Aa1a…`](https://sepolia.etherscan.io/address/0x8012aa1a220f34f519a902c8f446823e0dd363e5) |
| HCA account instance | `0xe4F6BBcf33656d55Cc50Cf2FAD344C208243031F` |
| Demo name | `autorenewdemo`, owned by the EOA |
| Setup: approve, cap = 2× quote | [`0xeb9820ae…`](https://sepolia.etherscan.io/tx/0xeb9820aeee6ebd5834e6773a8b9c08271056e75342a206ba9fab6c11e608116b) |
| **Renewal 1** | [`0x5c8e9a9d…`](https://sepolia.etherscan.io/tx/0x5c8e9a9d1b3a7ba0235377c85f251e9dad40a2900dd206b7341a96fa7051eb95) |
| **Renewal 2**, by `operator/submit.ts` | [`0xa2ce0c94…`](https://sepolia.etherscan.io/tx/0xa2ce0c948ef6adb68a161d81736d68b3e22aebcffa9ba7583b98c3f176e4e299) |
| **Fallback write** | [`0x1daf0755…`](https://sepolia.etherscan.io/tx/0x1daf07559df24d1da34bce945d17a160a20285a02ce530d8e6c516c3b0e27027) |

Expiry moved `2026-11-24` → `2027-11-25` → `2028-11-24`, each time by exactly
`31,557,600` seconds, the fixed duration in the session. The allowance went
`16,011,002` → `8,005,501` → `0`, decremented by exactly the quoted price each
time, then stopped. The ERC-20 allowance **is** the period cap, and the token
contract enforces it. No intermediate account ever holds funds.

## What it costs, stated here rather than found later

**Size.** At ENS's own compiler settings (solc 0.8.27, optimizer on,
`runs = 23000`) the validator goes from **19,753 to 22,307 bytes**: +2,554,
leaving **2,269 under the EIP-170 limit**, 90.8% used. That is the main
objection to this change and it is a real one. Measured at `runs = 200` the
figure looks far more comfortable and is wrong; `runs = 23000` is what ENS
deploys. The pristine build at those settings is byte-for-byte the size of the
deployed mainnet validator, which is how we know the source matches.

**No migration.** The three renew caps ride in spare high bits of two words the
salt already hashes, so the field count stays at seven and the derived
`permissionId` is unchanged. **A session authorised before this change keeps
working and the owner signs nothing new.** Not an argument: the salt change in
ENS's own pre-existing validator test was reverted to its form at HEAD and all
134 tests in `test/unit/hca/` still pass, including the sixteen that a
ten-field salt broke.

**One cost is ours.** The packed session proof header grows from 110 to 150
bytes to carry the caps on the wire. The owner signs the salt, not the
envelope, so signatures are unaffected — but any software that packs an
envelope must emit the longer header.

**Who is affected.** 2,869 HCAs exist on mainnet. Every one was created by a
direct call to `StandaloneHCAFactory.deploy`; no contract in contracts-v2 calls
it. This change reaches none of them unless the owner upgrades, which needs
both the DAO-held approval role and a transaction from the owner.

## Layout

    config/         the only address source, keyed by chain id
    operator/       session payload construction, submission, fallback, log
    operator/vectors/  golden vector emitted by a Foundry test
    reference/      ENS source pinned at f85062d3, for reading only
    progress/       working ledgers
    DECISIONS.md    D1-D11, each with its evidence
    THREAT-MODEL.md blast radius, filled from test results
    VERIFY.md       what was checked on chain, and what was not

## Verifying it yourself

    bun test operator/session.vector.test.ts        # 9 pass
    # in a contracts-v2 checkout with the branch applied:
    forge test --match-path 'test/unit/hca/*'       # 134 pass

The vector in `operator/vectors/` is emitted by `test_emit_typescriptVector`,
which asserts the account **accepts** the payload before printing it. So a
passing TypeScript test means this code produced a payload the deployed policy
accepted, not merely that two encoders agree.

The private keys in that vector are Foundry `makeAddrAndKey` derivations and
control nothing. See `operator/vectors/README.md`.

## Status

The contract rule, the operator path and the evidence are done. The demo
frontend in `app/` is unfinished. Nothing here has been proposed to ENS yet.
