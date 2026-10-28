# Vendored reference

A snapshot, not the truth. Read the repository for anything you will act on.

## Provenance

- Repository: `ensdomains/contracts-v2`
- Branch: `deploy/mainnet-v2-20261002` (PR #465, draft)
- Commit at read time: `f85062d340dd3ff49aac6b01d5d246bbb04737d9`
- Read: 2026-10-22
- Base of that branch: `post-audit-2`. Build against `post-audit-2`, not
  against the deployment branch.

These files were fetched through the GitHub API. They have not been compiled
here. Treat line numbers as approximate once you clone.

## Files

| File | Repository path | Why it is here |
| --- | --- | --- |
| `HCAOwnerAndSessionValidator.sol` | `contracts/src/hca/` | The file the change goes in. The policy is a chain of `if` statements on target and selector. |
| `HCAResolverPolicyLib.sol` | `contracts/src/hca/libraries/` | `_isRecordSelector` permits `IAddressSetter.setAddress`. The record setters do not check the value. This is why the fallback needs no change. |
| `HCARegistrarPolicyLib.sol` | `contracts/src/hca/libraries/` | The existing registrar and payment-token checks. Follow its shape. |
| `AbstractETHRegistrar.sol` | `contracts/src/registrar/` | `renew(RenewData, IERC20)` is `public` with no caller check and pulls from `msg.sender`. `renewBatch` is beside it. |
| `ETHRenewerV1.sol` | `contracts/src/registrar/` | The v1 renewal path during migration. `syncWrapper` touches v1 on every call. `GRACE_PERIOD = bonusPeriod + gracePeriod`. |
| `IPermissionedRegistry.sol` | `contracts/src/registry/interfaces/` | `latestOwnerOf`, `getState`, and the `State` struct the binding reads. |
| `HCA.md` | `docs/` | The session policy in prose. The renewal exclusion is stated as a decision. |
| `mainnet-addresses.md` | `contracts/deployments/mainnet/` | Deployed addresses. |
| `mainnet-roles.md` | `contracts/deployments/mainnet/` | Who holds what. `HCAUpgradeSet` APPROVE sits with the DAO timelock. |

## What was verified from these files

Each claim below was read directly, not inferred.

1. The session policy permits `commit`, `register`, `setNameWithHCA`,
   `claimWithHCA` and `deployProxy`. It does not permit `renew`.
2. Every permitted rule binds an address argument to the owner and reverts with
   `PolicyRuleFailed` otherwise.
3. `renew` carries no owner argument.
4. `renew` is `public`, has no caller check, and pulls ERC-20 from `msg.sender`.
5. `_isRecordSelector` includes `setAddress`, and the setters do not inspect the
   value written.
6. `State` holds `latestOwner`, read through `latestOwnerOf`.
7. `HCAUpgradeSet` APPROVE roles belong to `0xFe89cc7a…`, the DAO timelock.
8. `StandaloneHCAImplementation` has no owner.

## What was not verified

See `../VERIFY.md`. Six open items. Do not treat any of them as settled
because they appear in `PRD.md` or `ERD.md`.
