# Config pack

All network configuration lives here. Nothing else in this project may
hardcode an address.

## Files

| File | Purpose |
| --- | --- |
| `networks.ts` | Addresses, tokens and expectations, keyed by chain id. |
| `preflight.ts` | Startup checks. Asserts the chain matches `networks.ts`. |

## The go-live switch

ENSv2 mainnet runs the same contracts as ENSv2 Sepolia. The code, the ABIs and
the selectors are identical. So the switch is a chain-id change.

1. Point the RPC at mainnet.
2. Pass chain id 1 instead of 11155111.
3. Run preflight. It must pass before anything else runs.

Nothing else changes. If something else does change, the hardcoded address it
came from is a defect. Move it here.

## Two RPC paths

| Variable | Use | Why |
| --- | --- | --- |
| `*_READ_RPC_URL` | preflight, on-chain checks, expiry polling, ad-hoc `cast` | Keyless. `evm.stupidtech.net` races five public providers per request. |
| `*_RPC_URL` | `anvil --fork-url`, the Foundry test matrix | Needs a dedicated key. |

Do not point a fork at the read path. It is limited to 60 requests per 10
seconds per IP, and a fork fetches state lazily on every slot it touches, so
the test matrix exhausts that in seconds.

A racer is also the wrong shape for a fork. It answers from a different
provider on each call, so archive depth varies between calls. A fork wants one
consistent upstream.

Self-hosting `evm.stupidtech.net` removes both problems.

## What is pinned and what is read

**Pinned** in `networks.ts`: contract addresses, token addresses, the RPC
environment variable name, the explorer, and the provenance of each set.

**Read at runtime** and asserted against `expect`: the grace periods, the
accepted payment tokens, and the renewal price. These are per-deployment
values, not constants. A constructor argument can differ between networks and
between redeployments of the same network.

Do not copy a read value into `networks.ts` as a constant. Record it in
`expect`, so a change trips preflight instead of passing silently.

## Provenance

The two sets come from different branches, because the mainnet deployment
records live on the deployment branch and are not merged.

| Network | Branch | Commit | Deployed |
| --- | --- | --- | --- |
| sepolia | `post-audit-2` | `3e54cdb8` | 2026-10-01 |
| mainnet | `deploy/mainnet-v2-20261002` | `f85062d3` | 2026-10-18 |

`post-audit-2` is the source of truth. The published documentation lags it.

## State

Mainnet expectations are recorded, read on chain 2026-10-22: registrar grace
2,419,200 seconds, renewer grace 7,776,001 seconds, oracle accepts USDC and
DAI and rejects WETH and USDT.

**Sepolia expectations are null.** They have not been read. Fill them before
the first Sepolia run, and record the evidence alongside the run.

`needsVerification()` returns true for any network in that state.

## Sepolia uses mock tokens

Sepolia has `MockUSDC` and `MockDAI`, so the demo can mint its own funds.
Mainnet uses the real tokens. `tokensAreMocks` carries the difference. Any code
that mints must check it.
