# auto-renew

An ENS name can be renewed by anyone — renewal is permissionless. But an ENS
**session key cannot renew**, because `HCAOwnerAndSessionValidator` has no rule
for `renew`. `IETHRenewer.renew` carries no owner argument, so the policy's
`(target, selector)` chain has nothing to bind against and refuses the call.

A session key can `commit`, `register`, `setNameWithHCA`, `claimWithHCA` and
`deployProxy`. It cannot renew the name it was authorised for.

This repository holds the evidence for a one-rule change, closing the gap with opcode. 

**The contract change is not here.** It's six files on a branch:
<https://github.com/ensdomains/contracts-v2/compare/post-audit-2...estmcmxci:feat/hca-session-renew-rule>

## It runs on mainnet-equivalent contracts, for real

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

## The cost

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

**Who is affected.** 2,869 HCAs exist on mainnet. Every one was created by a
direct call to `StandaloneHCAFactory.deploy`; no contract in contracts-v2 calls
it. This change reaches none of them unless the owner upgrades, which needs
both the DAO-held approval role and a transaction from the owner.

## Layout

    config/         the only address source, keyed by chain id
    operator/       session payload construction, submission, fallback, log
    operator/vectors/  golden vector emitted by a Foundry test
    scripts/        regenerate the vector, reproduce the size measurements
    THREAT-MODEL.md blast radius, filled from test results

Comments here cite documents that are not in this repo: `DECISIONS.md`,
`VERIFY.md`, `STATE.md`, `AGENTS.md`, `ERD.md`, the demo script, the working
ledgers under `progress/`, and a vendored copy of ENS source under
`reference/`. They are the project's internal records, kept out of a repo
meant for review. The citations stay because each one says where a finding
came from, and a pointer with no document is still better than a claim with
no source.

## Verify it yourself

    bun test operator/session.vector.test.ts        # 9 pass
    # in a contracts-v2 checkout with the branch applied:
    forge test --match-path 'test/unit/hca/*'       # 134 pass

The vector in `operator/vectors/` is emitted by `test_emit_typescriptVector`,
which asserts the account **accepts** the payload before printing it. So a
passing TypeScript test means this code produced a payload the deployed policy
accepted, not merely that two encoders agree.

The private keys in that vector are Foundry `makeAddrAndKey` derivations and
control nothing. See `operator/vectors/README.md`.

## The fallback half

Writing a fallback address needs no contract change. `setAddress` is already
permitted by `HCAResolverPolicyLib`, so a session can call it — under two
conditions, both measured on Sepolia rather than read off the docs:

- the session's proof must NAME the resolver. The renew proof sets
  `resolver = address(0)` on purpose, since a renewal touches no resolver, so a
  `setAddress` under that session is refused. Measured against the live
  validator: `0xffffffff` for the renew-shaped session, the ERC-1271 magic
  value for one that names a conforming resolver.
- `checkBinding` requires that resolver to be a `VerifiableFactory` proxy of
  `PERMITTED_RESOLVER_IMPL`. The shared `ENSV2Resolver` is refused. The demo
  name had no resolver at all, so a conforming one had to be deployed and set
  before the fallback could run.

Renewal is the only half with no path.

## Status

The contract rule, the operator path and the evidence are done. A demo
frontend is not. Nothing here has been proposed to ENS yet.
