# evidence — progress ledger

One beat does ONE unchecked item, then stops.
You alone write VERIFY.md and STATE.md. Date every finding and name the method.
Mark anything unproven as unproven. Do not round up.

- [x] E1. Read AGENTS.md, VERIFY.md, config/README.md.
      2026-10-22: read all three in full. Key points carried forward: hard
      rules (no PR into contracts-v2 #465, no compromised key 0x1C2F...fF21,
      no estmcmxci.eth owner key, no frontend log entries from frontend state,
      frontend waits on the test matrix); VERIFY.md items 2 and 5 are DONE for
      both networks (grace periods, accepted payment tokens), items 1, 3, 4
      are OPEN, item 6 is DONE for mainnet only; config/README.md confirms
      Sepolia expectations in networks.ts are still null and must be filled
      before the first Sepolia run. Method: direct file read, no execution.
- [x] E2. VERIFY item 1: read the register path in the clone's ETHRegistrar for
      a minimum registration duration. Record the answer with the file and
      line. It decides whether Sepolia can show a real lapse.
      2026-10-22: there IS a minimum, 28 days, on both networks. Found
      `MIN_REGISTER_DURATION` (immutable, constructor-set) in
      `contracts-v2/contracts/src/registrar/ETHRegistrar.sol` line 53;
      enforced in `_requireAvailable` lines 254-256, called from `register()`
      and `getRegisterPrice()`. Clone pinned at commit 3e54cdb8
      (post-audit-2), matching config/networks.ts. Confirmed on chain via
      `cast call MIN_REGISTER_DURATION()(uint64)`: mainnet ETHRegistrar
      0xd6d8369e = 2,419,200s; sepolia ETHRegistrar 0xf633e7fc = 2,419,200s.
      Equals GRACE_PERIOD on both, not proven whether deliberate. Consequence:
      Sepolia cannot show a full register-expire-grace cycle in a short demo
      window; needs a 28+ day wait or a time-warped local fork. Full detail
      and the MIN_RENEW_DURATION distinction written into VERIFY.md item 1.
      Method: direct source read + on-chain cast call, no local ABI relied on.
- [x] E3. Read the Sepolia HCAUpgradeSet role holders at 0xcde956d6. They are
      recorded as unknown in config/networks.ts. Do not assume they match
      mainnet. Write the result into both files.
      2026-10-22: one EOA, 0x84D3A426D4E12E955d1DF95db0b24Fe26AFE39D3, holds
      the full root bitmap (APPROVE, APPROVE_ADMIN, CAN_NAME, CAN_NAME_ADMIN)
      on HCAUpgradeSet 0xcde956d6e2949bc25a4273f93e0db6f68a1a6f34 and nothing
      else holds any role on that resource. Confirmed with `cast call
      roles(uint256,address)`, `roleCount` and `getAssigneeCount` against
      SEPOLIA_READ_RPC_URL, plus `cast code` (0x, so an EOA not a contract).
      Candidate address came from the deployment record's argsData, not
      trusted on its own. Cross-checked the same method against mainnet's
      known DAO timelock, which also turns out to hold all four roles, not
      just APPROVE/APPROVE_ADMIN as the old comment said. Found
      `config/networks.ts` already partly updated with this exact finding
      when I went to write it — a prior beat on this same item appears to
      have written the networks.ts change and been cut off before VERIFY.md
      and this checkbox; this beat independently reproduced the same result
      before noticing, then wrote VERIFY.md item 7 and this entry. No
      conflict: both arrived at the same address and bitmap. Method: source
      read (PermissionedAddressSet.sol, IPermissionedAddressSet.sol) +
      deployment-record lookup + on-chain cast calls, no local ABI relied on
      for the conclusion.
- [x] E4. Probe the Sepolia oracle for further accepted payment tokens beyond
      the three recorded. There is no enumeration method, so probe and say so.
      2026-10-22: no view function enumerates the set, but every add/update/
      disable emits `PaymentTokenUpdated`, including at construction. Pulled
      the full `eth_getLogs` history for that event on the Sepolia oracle
      (0x8196665d4ca7488b6474a9ec8e7d2719fb42263a) from its deployment block
      11,820,430 to the current block 11,971,426 (one call, no range-limit
      error, no pagination needed). Exactly 3 events, all in the deployment
      tx, for the 3 already-recorded tokens (MockUSDC, MockDAI, Circle
      Sepolia USDC). Nothing added or disabled since. So this is a closed
      answer, not a probe: that is the complete set the oracle has ever
      accepted on Sepolia. Corrected the "open, probe-only" language in
      VERIFY.md item 5 to reflect the closed result; left mainnet's row
      alone since the same method was not re-run there this pass. Method:
      source read (StandardRentPriceOracle.sol event sites) + on-chain
      eth_getLogs via cast rpc, no local ABI relied on for the conclusion.
- [x] E5. Fund the deployer: Sepolia ETH for gas, and a payment token. Circle
      Sepolia USDC at 0x1c7D4B19 is faucetable and needs no mint rights.
      Record balances and the faucet used.
      2026-10-27: UNBLOCKED and DONE. The manager reported gas landed on
      `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31` (nonce 0, no faucet detail
      given); independently re-verified on chain before acting, not taken on
      claim alone: `cast balance` returned 5,000,000,000,000,000 wei
      (0.005 ETH) via `SEPOLIA_READ_RPC_URL`, and `cast nonce` returned 0,
      matching. Then self-minted both mock payment tokens per E5b's plan,
      using the project's own deployer key from `.env`
      (`DEPLOYER_PRIVATE_KEY`, confirmed via `cast wallet address` to be this
      same address — neither the compromised key nor the `estmcmxci.eth`
      owner key) against `SEPOLIA_RPC_URL` (the dedicated provider, not the
      read-only racer):
      - `mint(0x41baA860cf727eAbbbE5f469E0cF5A0833148F31, 1000000000)` on
        MockUSDC `0x240b0316df57887dbbe58b586508b19e633a14aa` — tx
        `0x87809a39e356e27127732864c4960ee5b021da1ed98b4f2950e14496227a31b9`,
        block 12,007,159, status 1 (success).
      - `mint(0x41baA860cf727eAbbbE5f469E0cF5A0833148F31, 1000000000000000000000)`
        on MockDAI `0xf6fac8a58a0be13b9197f27c41b73162fe32572b` — tx
        `0xfa6042dbefae9ad3ce13a779dd16882fca0d0a05eb9d5508042ecdf76505bf6b`,
        block 12,007,160, status 1 (success).
      Final balances, read fresh via `cast balance` / `cast call
      balanceOf(address)` on `SEPOLIA_READ_RPC_URL`, not assumed from the tx
      output: 4,999,859,381,937,932 wei ETH (≈0.0049999, ~140,618 wei spent
      on gas across both sends — base fee was in the low tens of wei per the
      manager's note, so the two mints cost very little), 1,000,000,000 raw
      MockUSDC (1,000 USDC, 6 decimals), 1,000,000,000,000,000,000,000 raw
      MockDAI (1,000 DAI, 18 decimals). Nonce is now 2. Circle Sepolia USDC
      was not touched — not needed, the mocks cover the oracle's accepted
      set. Method: on-chain `cast balance`/`cast nonce` re-verification
      before acting (not trusting the manager's report alone), then two real
      `cast send` transactions from the project's own `.env` key, then a
      fresh post-tx balance read — no local assumption relied on. This is
      the project's first real Sepolia transaction. VERIFY.md item 5 updated
      to record the same.

      Superseded history below (how E5 got to BLOCKED, then unblocked):
      2026-10-22, BLOCKED: confirmed the deployer key in `.env` is set and is
      neither the compromised key nor the `estmcmxci.eth` owner key — derived
      its address with `cast wallet address`:
      `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31`. Balance on Sepolia, read
      via `SEPOLIA_READ_RPC_URL`: 0 ETH (`cast balance`), 0 Circle Sepolia USDC
      (`cast call balanceOf`). So funding is genuinely needed, not already
      done.

      Cannot complete the funding step itself. There is no faucet API key or
      drip endpoint anywhere in `.env` or `.env.example` — only RPC and
      Etherscan keys are configured. Every Sepolia ETH faucet I know of
      (Alchemy, Infura, Google Cloud Web3, QuickNode, Chainlink) gates the
      claim behind an interactive CAPTCHA and/or a third-party account
      login (GitHub, Google, or a mainnet-wallet signature proving mainnet
      ETH held). An unattended agent cannot complete that, and attempting to
      script around CAPTCHA/bot-gating is out of scope regardless. Claiming
      from the wrong account or burning a faucet's daily rate limit on a
      mistaken attempt is also not reversible inside a beat, so I did not
      guess at a login.

      What remains: a human claims Sepolia ETH (and, if needed, Circle
      Sepolia USDC — same faucet gating applies) to
      `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31` once, through whichever
      faucet account they already hold. The next beat can then record the
      resulting balances and tx hash; it cannot do the claim itself either,
      for the same reason. Method: direct `.env`/`.env.example` read, `cast
      wallet address`, `cast balance`, `cast call` — no local assumption
      relied on for the zero-balance conclusion.

      Update, 2026-10-22 (E5b): the payment-token half no longer needs a
      faucet — MockUSDC and MockDAI mint openly, see E5b and VERIFY.md item
      5 for the exact calls. Only Sepolia ETH for gas still needs a human
      faucet claim to `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31`. Still 0
      ETH as of this beat.
- [x] E5b. NOT GATED, do this before E5. Determine whether the ENS-deployed
      MockUSDC (0x240b0316df57887dbbe58b586508b19e633a14aa) and MockDAI
      (0xf6fac8a58a0be13b9197f27c41b73162fe32572b) on Sepolia can be minted by
      anyone. Read their bytecode or verified source and look for a public or
      unguarded mint/faucet/drip function and any owner or role check. Use
      SEPOLIA_READ_RPC_URL.
      Why: every Sepolia ETH and Circle USDC faucet is behind a CAPTCHA or an
      account login, which an unattended agent cannot pass. If a mock token
      mints openly, the payment-token half of E5 needs no faucet at all; the
      deployer mints its own. That leaves only gas as a human task.
      Do NOT send a transaction. The deployer has 0 ETH, so a mint would fail
      anyway. Report the answer and the exact call that would work, so E5 can
      run the moment gas arrives.
      Record the finding in VERIFY.md item 5 with the method and the date.
      2026-10-22: yes, open to anyone. Both tokens are this project's own
      `contracts-v2/contracts/test/mocks/MockERC20.sol` (commit `3e54cdb8`,
      not the vendored forge-std mock). `mint(address,uint256) external` line
      26 has no modifier and no caller check — straight to `_mint`. Confirmed
      live, not just from source: `cast call` (not `cast send`, no tx)
      simulated `mint(<deployer>, <amount>)` on both contracts with `--from
      0x000000000000000000000000000000000000dEaD`, an address with no
      relationship to either token, against `SEPOLIA_READ_RPC_URL`. Both
      succeeded, no revert. The exact calls that will work once the deployer
      has gas are written into VERIFY.md item 5, including raw-unit amounts
      for each token's decimals (USDC 6, DAI 18 — cross-checked via
      `decimals()`/`symbol()` the same call). Circle Sepolia USDC was not
      tested and is not expected to be open; it's a real third-party token.
      Updated E5's note below: only Sepolia ETH gas remains a human-faucet
      dependency now. Method: source read + on-chain `cast call` simulation
      from an unprivileged address, no local ABI relied on for the
      conclusion, no transaction sent.

- [x] E6. GATED on contracts C1. Deploy the private HCA stack to Sepolia with
      contracts/deploy/hca. Approve the modified implementation in your own
      factory. Request nothing from ENS.
      2026-10-27, FIFTH update, from the manager: the SECOND update's deploy
      ran under rocketh environment `sepolia` — the SAME directory
      (`contracts/deployments/sepolia/`) that holds the official ENS
      deployment records `config/networks.ts` describes, not a private
      namespace. It overwrote `StandaloneHCAFactory.json` and
      `DefaultReverseRegistrarAdapter.json` there, so those two files were
      left claiming ENS's official Sepolia contracts are owned by this
      project's throwaway deployer. False, and flagged by the manager, not
      caught by me: I had reasoned (SECOND update) that this was safe
      because the files are git-tracked and reversible, which is true
      mechanically, but missed that leaving the false claim sitting in the
      working tree even temporarily is itself the problem, independent of
      whether `git checkout` could fix it later. The two live contracts
      (`StandaloneHCAFactory` `0xe4e3738f62caeb641cc724378487c8c22fec537e`,
      `DefaultReverseRegistrarAdapter`
      `0x1b961e5994ead11ebcc4e53beeb8a36c91bab436`) are correct and stay
      live, not redeployed — only the local bookkeeping of which namespace
      they are recorded under was wrong. The manager is fixing it directly:
      copying our two records to `contracts/deployments/sepolia-autorenew/`,
      git-restoring the two official files in `contracts/deployments/sepolia/`,
      and adding our two addresses to `config/networks.ts` under a new
      `autoRenew` section. Per instruction, this beat did not touch
      `contracts/deployments/sepolia-autorenew/`,
      `contracts/deployments/sepolia/{StandaloneHCAFactory,DefaultReverseRegistrarAdapter}.json`,
      or `config/networks.ts`, and ran no further rocketh deploy under
      environment `sepolia`. E7 resumes once the manager confirms, reading
      the two addresses from `config/networks.ts`'s new section only, not
      from the `sepolia/` directory and not retyped from this note.

      FOURTH update: DONE, via path (c) from the THIRD update
      below — deployed the three remaining contracts and ran the approval
      call directly with `forge create`/`cast send`, bypassing rocketh's
      dependency cascade entirely so the ENS-v1-owner-gated `setController`
      call (the THIRD update's blocker) was never reached. Needed no key
      beyond this project's own deployer.

      Every constructor argument was read from source first, not guessed:
      `src/hca/HCAOwnerAndSessionValidator.sol` constructor (line 229),
      `src/utils/PermissionedAddressSet.sol` constructor (line 34),
      `src/hca/StandaloneSingleOwnerHCA.sol` constructor (line 139) — each
      checked against the exact args the matching `deploy/hca/*.ts` file
      passes, with shared addresses (`ReverseRegistrarAdapter`,
      `PermissionedResolverImpl`, `ETHRegistry`, `VerifiableFactory`)
      cross-checked against the live JSON records in `deployments/sepolia/`
      (all matched `config/networks.ts` exactly, no staleness found), and
      `intentExecutor`/`gasRefundPaymaster` resolved by hand from
      `deploy/hca/_helpers.ts`'s `resolveHCAIntentExecutor` plus
      `script/deploy-constants.ts`'s `RHINESTONE_INTENT_EXECUTOR` /
      `RHINESTONE_GAS_REFUND_PAYMASTER` constants (sepolia takes the
      production Rhinestone default; no `HCA_INTENT_EXECUTOR` override, no
      local mock executor deployed — confirmed by its absence from
      `deployments/sepolia/`, so the production path was the only live
      option, not a choice).

      Four real transactions, all independently confirmed on chain with
      `cast receipt`/`cast call` (not taken from `forge create`'s own
      printed output alone):
      - `HCAOwnerAndSessionValidator` deployed at
        `0x8012Aa1a220F34f519A902C8f446823E0Dd363E5`, tx
        `0xd17cc7f7fcc69034dac941abb77961dddacaef777b732a1c0ff66c3407eeb8c1`,
        block 12,007,298. Args: `[defaultReverseRegistrarAdapter=
        0x1B961e5994EaD11eBcc4E53beeb8a36c91baB436 (this project's own, from
        the SECOND update), reverseRegistrarAdapter=0x56bce5e727faa9d237341bb5b9e8a03d5919779d,
        permittedResolverImpl=0x115eb53f0c60696633855f90b138178fb40b2b2c,
        ethRegistry=0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4,
        verifiableFactory=0xda70306c98e97ece36f997a21368e53298572991,
        intentExecutor=0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF,
        gasRefundPaymaster=0x1d7df6Ddc7328Ac827EB4D7f171C60AFB7f9A599]`.
      - private `HCAUpgradeSet` (a fresh `PermissionedAddressSet`, NOT the
        shared `0xcde956d6...` from E3 — the implementation deploy file
        creates its own independent set, by design, so approvals stay
        directional per implementation) deployed at
        `0x19Ec1e0F3b99364CF6a294552Ef4a129DfE341c7`, tx
        `0x2517722cc8dcc7c09669270c57edeb9f329f2dd173b2e27becea0d89e23e2025`,
        block 12,007,299. Arg: `[rootAccount=the deployer]`.
      - `StandaloneHCAImplementation` deployed at
        `0x9E2deb6Fb870afF73460D45314e5D73865f82D51`, tx
        `0xb0613efd10e5b0e11577eb594df3d9ea90161f4d1b46163401dda69986aa1c9c`,
        block 12,007,301. Args: `[entryPoint=0x0000000071727De22E5E9d8BAf0edAc6f37da032
        (DEFAULT_ENTRY_POINT, no HCA_ENTRY_POINT override), defaultValidator=
        the HCAOwnerAndSessionValidator above, intentExecutor=same as above,
        validatorInitData="0x", upgradeSet=the HCAUpgradeSet above,
        predecessorUpgradeSet=zero address, ownerRegistry=
        0xE4e3738f62CaeB641CC724378487c8c22fEC537E (this project's own
        StandaloneHCAFactory, from the SECOND update)]`.
      - `setImplementationApproval(0x9E2deb6Fb870afF73460D45314e5D73865f82D51, true)`
        called on the private factory `0xE4e3738f62CaeB641CC724378487c8c22fEC537E`,
        tx `0xb6160f5b75a3d659e8fbbb0e1c2b17fbe3415b04c484f6e1ca222dc01d8d7cc2`,
        block 12,007,302, status 1. Re-read, not assumed:
        `approvedImplementations(0x9E2deb6Fb870afF73460D45314e5D73865f82D51)`
        on the factory returns `true`.

      The private stack is now complete and self-contained: factory
      `0xE4e3738f62CaeB641CC724378487c8c22fEC537E` (owner = this project's
      deployer, from the SECOND update) has approved implementation
      `0x9E2deb6Fb870afF73460D45314e5D73865f82D51`, which points at its own
      validator, its own upgrade set, and reuses only the real,
      already-existing, read-only shared infrastructure
      (`VerifiableFactory`, `ETHRegistry`, `PermissionedResolverImpl`,
      `ReverseRegistrarAdapter`) plus this project's own
      `DefaultReverseRegistrarAdapter` instance. Nothing here asked ENS's
      v1 owner, or any other outside party, for anything. Final state,
      re-checked fresh: nonce 8 (was 4 before this update's four sends),
      balance 4,999,857,925,567,877 wei.

      Method: every address fed into a constructor was read from this
      beat's own source/JSON-record checks, not retyped from an earlier
      note; every resulting deployment was independently confirmed with
      `cast receipt` or `cast call` against `SEPOLIA_READ_RPC_URL`, never
      trusted from a tool's own stdout alone.

      THIRD update, 2026-10-27: BLOCKED, for a reason the ledger did not
      anticipate. Not a flaky RPC error — root-caused and reproducible.
      `--resume --tags hca` cannot finish via the standard pipeline without
      a signature this project does not have and should not seek.

      ROOT CAUSE, found by temporarily instrumenting the vendored
      `eip-1193-jsonrpc-provider` package (in `node_modules`, not tracked,
      not project source, logging added then left in place, harmless) to
      print the response body the library itself was discarding before
      throwing. The real failing call:
      `DefaultReverseRegistrar.setController(0x1B961e5994EaD11eBcc4E53beeb8a36c91baB436, true)`
      — `0x4F382928805ba0e23B30cFB75fC9E848e82DFD47` is ENS's own v1
      `DefaultReverseRegistrar` (confirmed via `lib/ens-contracts/deployments/sepolia/DefaultReverseRegistrar.json`),
      selector `0xe0dba60f` confirmed as `setController(address,bool)` via
      `cast sig`. This call tries to register last beat's new
      `DefaultReverseRegistrarAdapter` as an authorized controller on
      ENS's v1 reverse registrar — a write to a contract ENS's v1 owner
      controls, not this project's deployer. The attempted `from` was
      `0x0f32b753afc8abad9ca6fe589f707755f4df2353`, which did not match our
      deployer, confirming no local key covers it (`SEPOLIA_V1_OWNER_KEY`/
      `V1_OWNER_KEY` are not in `.env`, correctly — this project has never
      had and should not seek v1-owner authority). With no local key, the
      tooling fell back to asking the RPC node to sign node-side
      (`eth_sendTransaction`), which Alchemy flatly refuses:
      `{"code":-32600,"message":"Unsupported method: eth_sendTransaction on ETH_SEPOLIA"}`
      — a real, informative rejection the library's own error handling was
      silently dropping before this beat's instrumentation exposed it.

      WHY THIS KEEPS HAPPENING, not a one-off: `01_HCAOwnerAndSessionValidator.ts`
      lists `DefaultReverseRegistrarAdapter` in its `dependencies`. rocketh
      rebuilds the full dependency graph fresh on every invocation and
      re-queues that id regardless of whether it already ran in a prior
      process; the adapter's own deploy script evidently bundles the
      contract deploy (now idempotent, correctly skipped on retry, matching
      address) together with this `setController` wiring call in one
      script, and the wiring call has no apparent idempotency guard, so it
      is retried, and fails the same way, on every single invocation.
      `--tags hca` cannot be scoped narrower than this from the CLI alone —
      the dependency is transitive, not optional.

      THIS DIRECTLY MATCHES THE ITEM'S OWN "Request nothing from ENS":
      finishing the standard pipeline as-is requires asking ENS's v1
      governance to sign something. Not done, and not going to be
      attempted by acquiring or impersonating that key.

      WHAT IS NOT AT RISK: the two real contracts from the last beat
      (private `StandaloneHCAFactory` at `0xE4e3738f62CaeB641CC724378487c8c22fEC537E`,
      its `DefaultReverseRegistrarAdapter` at
      `0x1B961e5994EaD11eBcc4E53beeb8a36c91baB436`) are unaffected,
      correctly deployed, and did not need to be undone. Re-verified nonce
      (4, unchanged) and balance (4,999,859,233,491,217 wei, unchanged) after
      this beat's failed attempt — the rejected call cost no gas.

      PATHS FORWARD, not chosen without a decision: (a) the operator
      supplies real v1-owner authorization the way gas was supplied for E5
      — unlikely to be appropriate, v1 governance is ENS's, not this
      project's, and E6's own text argues against it; (b) edit the
      upstream deploy script to skip or guard the `setController` call for
      an HCA-only, non-ENS-facing run — a change to contracts-v2's own
      deploy tooling, not something to do unilaterally without a decision,
      since it alters shared migration logic beyond this item's scope; (c)
      deploy the three remaining named contracts
      (`HCAOwnerAndSessionValidator`, `HCAUpgradeSet` +
      `StandaloneHCAImplementation`) and run the factory-approval call
      directly with `cast send`, one at a time, using already-known
      addresses as constructor args, bypassing rocketh's dependency cascade
      (and the v1 call) entirely. (c) is the most promising and does not
      need anyone's permission beyond this project's own deployer key, but
      is manual, slower, and was not started this beat — the three
      contracts' exact constructor argument lists are already known from
      reading `deploy/hca/01_HCAOwnerAndSessionValidator.ts` and
      `03_StandaloneHCAImplementation.ts` in a prior beat; the next beat can
      pick this up directly rather than re-deriving it.
      Method: real retries against the live chain (both confirmed to cost
      no gas via fresh `cast nonce`/`cast balance`), a temporary, surgical
      edit to a vendored (not project, not git-tracked) debug-logging path
      to recover a response body the library discards, `cast sig` to
      confirm the selector, and a direct grep match against
      `lib/ens-contracts/deployments/sepolia/DefaultReverseRegistrar.json`
      to identify the target contract — nothing guessed, nothing retried
      blind a third time once the cause was known.

      SECOND update, 2026-10-27: the deploy RAN, for real, and partly
      succeeded. Two real Sepolia transactions, both independently verified
      on chain with `cast receipt` (not taken from the local JSON record
      alone), both `status 1 (success)`, both `from` the project's own
      deployer `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31`:
      - nonce 2: new `StandaloneHCAFactory` deployed at
        `0xE4e3738f62CaeB641CC724378487c8c22fEC537E`, tx
        `0x5f949f75752a040219d954a0d57c4df59eeca32383bf1f0cfbfb97c26612474c`,
        block 12,007,235. Constructor args (read from the local deployment
        record's `argsData`, cross-checked against the 03/02 file's `get()`
        call): `[VerifiableFactory=0xda70306c98e97ece36f997a21368e53298572991
        (the REAL existing one, reused, not redeployed — confirmed by its
        presence as an arg rather than a new address), owner=the deployer]`.
        This is the "approve the modified implementation in your own
        factory" factory the item names: owner-held, not ENS's.
      - nonce 3: new `DefaultReverseRegistrarAdapter` deployed at
        `0x1B961e5994EaD11eBcc4E53beeb8a36c91baB436`, tx
        `0x938f2421edc9bef8d1d9552c94862def6a6c8ef27d55b6c3ea8cc7e210e39820`,
        block 12,007,236. Constructor args include the NEW private
        `StandaloneHCAFactory` address above — this was NOT one of the four
        named `deploy/hca/*.ts` files, but a dependency the run pulled in on
        its own: the existing shared `DefaultReverseRegistrarAdapter` (the
        one `config/networks.ts` points at, `0x36f97328e843e37520cbf530e9402791c2754066`)
        was built against the SHARED factory, so once a new private factory
        existed, rocketh's own `deploy()` saw the args no longer matched and
        deployed a fresh instance for the private wiring. The shared/official
        adapter at its original address was NOT touched, removed, or broken —
        this is an additional contract, not a replacement. Not scary, just
        unannounced: write it down so the next beat does not mistake it for
        an accident.

      THEN THE RUN CRASHED, on whatever came next (not yet identified by
      name — `HCAOwnerAndSessionValidator.json` and
      `StandaloneHCAImplementation.json`/`HCAUpgradeSet.json` are UNCHANGED,
      still the shared/official ones, so the private stack is only
      PARTLY built: the factory and its reverse-adapter dependency exist
      privately; the validator, the implementation, and the upgrade set do
      not yet have private counterparts, and the `04_SetupStandaloneHCA.ts`
      approval call has not run). The crash: `error: Failed To Fetch (status
      = 400) at https://eth-sepolia.g.alchemy.com/v2/... (method:
      eth_sendTransaction)`. Re-checked the deployer immediately after, not
      assumed: `cast nonce` = 4 (exactly 2 higher than E5's end state, i.e.
      exactly the two sends above and NO more — the failed call consumed no
      nonce, so nothing was broadcast-but-dropped) and `cast balance` =
      4,999,859,233,491,217 wei (down only 148,715 wei from E5's end state,
      consistent with two small contract deploys at ~18 wei base fee, not
      with anything larger failing silently).

      WHY NOT RETRIED YET: the failure is an HTTP-layer 400 from Alchemy,
      not a revert and not insufficient funds (the manager's two named
      exception cases), so this is exactly the kind of "wrong for a reason
      the ledger does not anticipate" case the rules say to write down
      rather than guess around. Leading unconfirmed guess: the next
      contract in line is the biggest of the four
      (`StandaloneHCAImplementation`, ~225KB deployment record vs ~45-60KB
      for the other three), so its `eth_sendTransaction` payload may be
      larger than something in the request path accepts — not verified.
      Retrying the same command blind risks either the same clean failure
      again (fine, just wasted effort) or, if the real cause is something
      stateful instead, a nonce or ordering problem on a real network,
      which is harder to undo than a 400. Did not guess at a different RPC
      endpoint, a reduced tag set, or any other workaround not already
      verified against source.

      What was fully confirmed and did NOT need to be guessed, carried over
      from the first update: the command is
      `bun ./script/migrate.ts phase deploy-v2 --network sepolia --resume
      --tags hca`, with `DEPLOYER_KEY` exported in-shell from `.env`'s
      `DEPLOYER_PRIVATE_KEY` (never written to any file) and `SEPOLIA_RPC_URL`
      likewise exported in-shell, because `migrate.ts` loads its OWN
      `.env` relative to itself (`contracts-v2/contracts/.env`, which does
      not exist) and will not see the project's root `.env` otherwise.
      `--resume` is not optional style — omitting it archives the entire
      `sepolia` deployment namespace before deploying, per the command's own
      description, which combined with the dependency cascade below would
      force a real redeploy of the whole stack. Confirmed from the real
      pinned `rocketh@0.19.3` executor source
      (`recurseDependencies`/`scriptIdBags` in
      `~/.bun/install/cache/rocketh@0.19.3@@@1/src/executor/index.ts`) that
      a script's `dependencies` array is pulled in regardless of `--tags`
      filtering, and from the real pinned `@rocketh/node@0.19.3`
      deployment-store source (`deployment-store.ts`) that there is no
      fallback between differently-named deployment-network folders — so a
      brand-new `--deployment-network` name would have forced exactly that
      full redeploy; omitting it (so it defaults to `sepolia`, the existing
      shared namespace) was correct, now proven empirically correct by the
      fact `VerifiableFactory` was reused, not redeployed. Also needed, not
      previously recorded: `node_modules` did not exist in
      `contracts-v2/contracts` (STATE.md's own "confirm the clone builds,
      not yet run" was literal); `bun install` (456 packages, from the
      local bun cache, under a second) and `bun run compile` (`forge build`
      + `hardhat compile`, both succeeded, 112 warnings, 0 errors) were run
      first and are durable, reusable progress — the clone builds now.
      The four tracked `deployments/sepolia/*.json` files this run touched
      were backed up to `/tmp/e6-backup/` before running, and git confirms
      the touched ones are tracked and were clean beforehand, so reverting
      is possible with `git checkout` if ever wanted — not done, because
      these two new records are correct and wanted, not a mistake.

      WHAT WOULD UNBLOCK: diagnosing the 400 directly (capture the actual
      outgoing request body/size for the next transaction rather than
      guessing at its cause), or the operator confirming the Alchemy
      endpoint has no unusual request-size limit for this key, or trying
      `--tags hca` with a smaller, more specific tag if one exists for just
      the remaining three steps so a failure retry does not also re-touch
      the two steps that already succeeded (deploy() will no-op them
      anyway since they are now already recorded, but narrowing the blast
      radius of a retry was not checked for feasibility this beat).
      Method: ran the real command, tee'd full output to
      `/tmp/e6-deploy-output.log`, cross-checked the result against the
      live chain with `cast nonce`, `cast balance`, `cast receipt` (both
      transactions), and `cast compute-address` + `cast code` (confirmed
      bytecode exists at both computed CREATE addresses before trusting the
      JSON record's own `address` field), plus reading the two changed
      deployment JSON files' `transaction.hash`, `receipt.blockNumber`, and
      `argsData` directly. Nothing in this update is inferred from the tool
      output's prose alone; every address, hash, and block number was
      re-read from the chain or the record, not retyped from memory.

      FIRST update, 2026-10-27, gate CHECKED and met, deploy NOT yet run —
      stopped on purpose before a real deploy command, for a reason below.
      Read this before guessing at an invocation; do not run one not
      already written here.

      GATE: `progress/contracts.md` C1 is `[x]`, dated 2026-10-22: all nine
      `AutoRenewPolicy.t.sol` cases pass in one run (133 passed, 0 failed, 0
      skipped across the full `test/unit/hca` tree), against a fork of
      Sepolia holding the DEPLOYED `ETHRegistry`/`ETHRegistrar`, with the
      modified validator. C1 is met.

      THE FOUR FILES at `contracts-v2/contracts/deploy/hca/`
      (01_HCAOwnerAndSessionValidator.ts, 02_StandaloneHCAFactory.ts,
      03_StandaloneHCAImplementation.ts, 04_SetupStandaloneHCA.ts) are a
      rocketh deploy pipeline, tagged `hca`, gated by
      `shouldDeployStandaloneHCA(tags)`. `02` deploys `StandaloneHCAFactory`
      with OUR OWN `owner` as a constructor arg — a private, owner-held
      factory, not ENS's. `04` calls
      `hcaFactory.setImplementationApproval(implementation, true)` — the
      "approve the modified implementation in your own factory" step the
      item names. No step asks ENS for anything; it is all read-dependency
      on existing contracts (`ETHRegistry`, `VerifiableFactory`, the
      reverse-registrar adapters), which matches "request nothing from
      ENS".

      THE DRIVER, found by reading `script/migrate.ts` (8000+ lines, not a
      short script): `phase deploy-v2`, with
      `--tags hca --deployment-network <name> --network sepolia`. The
      command's own `--tags` help text says literally: "use --resume --tags
      hca for an HCA-only update." `envPrivateKey("DEPLOYER_KEY")` (in
      `script/migrations/plumbing.ts`) reads `process.env.DEPLOYER_KEY`
      verbatim, no fallback name, so `.env`'s `DEPLOYER_PRIVATE_KEY` would
      need re-exporting under that exact name for this command to find it.
      On a non-mainnet network the owner account DEFAULTS to the deployer
      (`ownerAddress = opts.owner ?? (network === "mainnet" ? MAINNET_DAO :
      deployerAddress)`, line ~8434), so sepolia is safe by default: nothing
      here can reach for the DAO or any `estmcmxci.eth` key.

      WHY NOT RUN YET. Two things are not settled, and guessing at either
      risks a wrong, expensive, and very hard to reverse action — redeploying
      part or all of the shared ENSv2 Sepolia stack under the wrong name, or
      writing a private deployment's addresses into the shared
      `deployments/sepolia/` ledger this project does not own:
      1. `--deployment-network <name>`: unset, it most likely resolves to
         `sepolia` and would write into the EXISTING
         `contracts-v2/contracts/deployments/sepolia/` directory, which
         already holds entries for `HCAOwnerAndSessionValidator`,
         `StandaloneHCAFactory`, `StandaloneHCAImplementation` and
         `HCAUpgradeSet` — the shared/official stack `config/networks.ts`
         points at. A private stack needs its OWN name, not that one. The
         repo's existing `deployments/sepolia-20260629-r1/`,
         `-20260730-r1/`, `-20260915-r1/` folders show the project's own
         naming convention for exactly this kind of private/dated
         deployment — but which pattern, if any, is required (vs. free
         choice) is not verified from the code read so far.
      2. Whether `get<T>("ETHRegistry")` and the other shared dependencies
         resolve against the NEW private `--deployment-network` namespace
         (empty, so rocketh would try to deploy a full new ETHRegistry,
         RootRegistry, etc. — NOT what this item wants) or whether rocketh
         falls back to the existing `sepolia` deployment records for
         anything the new namespace does not itself record. This lives in
         `rocketh/environment.ts` and `rocketh/config.js`
         (`loadAndExecuteDeploymentsFromFilesWithConfig`), not yet read.
         Running `--tags hca` into an empty namespace without this answer
         could either error cleanly (fine) or silently try to redeploy the
         entire v2 migration stack fresh (not fine, and expensive even on a
         testnet — RootRegistry, ETHRegistry and the rest are not cheap).

      NOT a faucet, nonce, or CAPTCHA blocker like E5 was — a design-reading
      blocker. The deployer has gas (0.005 ETH per E5) and can act the
      moment this is resolved.

      WHAT WOULD UNBLOCK, without more guessing: either (a) read
      `rocketh/environment.ts` and `rocketh/config.js` to answer point 2
      directly, or (b) the operator names the exact `--deployment-network`
      value and confirms dependency resolution, or (c) a dry run exists
      (grep did not surface one in the time available this beat) that shows
      the planned writes before anything broadcasts.
      Method: direct source read of all four `deploy/hca/*.ts` files, the
      `phase deploy-v2` command definition and `envPrivateKey`/`envValue` in
      `script/migrate.ts` and `script/migrations/plumbing.ts`, plus
      `ls contracts-v2/contracts/deployments/` for the existing namespace
      names. No command run, no transaction sent, nothing fabricated.
- [x] E6.5. NOT GATED. Added by the manager 2026-10-27, splitting the real
      part of E7's "setup" out of the part that waits on demo O1 (the
      operator's renewal-submit code, owned by the demo agent per
      `progress/demo.md`, not built here). Create an account instance from
      the private factory `0xe4e3738f62caeb641cc724378487c8c22fec537e`.
      Register a name to it with the real commit-reveal cycle
      (`MIN_COMMITMENT_AGE` 60s). Pick an unregistered demo label, check
      first. Pay with the tokens already held from E5. Record every
      resulting address and tx hash in `config/networks.ts` `ourStack` and
      `contracts/deployments/sepolia-autorenew/`. This gives E7 the account
      and the name; the renewal transaction itself still waits on O1.
      2026-10-27, in progress this beat:
      - Account created from the private factory via its own
        `deploy(address owner, address hcaImplementation, uint256 userSalt)`
        (read from `src/hca/StandaloneHCAFactory.sol`, not guessed):
        `deploy(0x41baA860cf727eAbbbE5f469E0cF5A0833148F31,
        0x9E2deb6Fb870afF73460D45314e5D73865f82D51, 1)`. Predicted address
        confirmed with a `cast call` simulation before sending. Account:
        `0xe4F6BBcf33656d55Cc50Cf2FAD344C208243031F`, tx
        `0x86e48adf1600eb903a4d67e4bb441977cd3be05d216bbab58c72f8a591700aa9`,
        block 12,007,668. Re-read `hcaOwners(account)` on the factory after
        the send: returns the deployer, matching.
      - FINDING, not anticipated: tried to register the demo label directly
        to that account address as owner (the item's literal "register a
        name to it"). Reverted: `NoNFTAllowed` (selector `0x6e29a697`).
        Read the source to find out why rather than retrying blind:
        `src/hca/StandaloneSingleOwnerHCA.sol` line 97 declares the error;
        lines 342-358, `_fallback`, reject every ERC721/1155 receiver-hook
        selector unconditionally, by design, before forwarding anything
        else to Nexus. `ETHRegistry.register()` apparently safe-mints (the
        revert surfaced through the HCA's own fallback, which only runs if
        the registry actually invokes the receiver hook on the recipient
        it is minting to), so an HCA account of this implementation can
        never be the direct registry-owner of a name. This is a property
        of the contract, not a mistake in the call. It also means the
        auto-renew design cannot be "the HCA owns the name"; it must be
        "the HCA is authorized to call renew() funded by the human owner's
        wallet" (consistent with `DECISIONS.md` D6/D8's `FundingPolicyState`
        pulling from `state.owner`, not from the HCA itself).
      - Substituted the account's own owner (the deployer, an EOA, exempt
        from the receiver-hook check) as the name's registry-owner instead,
        since that is the literal human/EOA this HCA instance is bound to.
        Flagging this substitution rather than silently doing it: if "to
        it" was meant literally, this contract cannot do that, by design,
        and the instruction needs revisiting rather than a different
        workaround. New commitment computed and sent for this corrected
        owner: tx `0x83c7c50d93a485ce3334a95e601db78fd0ade49971f11c3f1ca4cecdfa216c73`,
        block 12,007,687. The first commitment (owner = the HCA account)
        was never consumed, since the whole `register` call reverted before
        completing, so no state was left behind by the failed attempt
        beyond its own gas cost.
      - Approved 613,701 raw MockUSDC (the exact `getRegisterPrice` quote
        for `autorenewdemo`, 28-day duration, base 613,701 / premium 0) to
        the registrar: tx
        `0xcd2442f085bf11a7b80cce2596020009556b18e78c4f26258e94dffb250bb98c`,
        block 12,007,676. Unaffected by the reverted register call, so not
        redone.
      - DONE. `register("autorenewdemo", 0x41baA860cf727eAbbbE5f469E0cF5A0833148F31,
        zeroHash, zeroAddress, zeroAddress, 2419200,
        0x240b0316df57887dbbe58b586508b19e633a14aa, zeroHash)` sent after
        the second commitment's `MIN_COMMITMENT_AGE` cleared: tx
        `0xd8d7a0b183f82c4bc2e1bdb9ccc03b974f09f917b205ae0159c86e98ef21ee66`,
        block 12,007,695, status 1. Independently re-checked, not assumed
        from the send output: `isAvailable("autorenewdemo")` on the
        registrar now returns `false`. Token id (label hash, `cast keccak
        "autorenewdemo"`, matches the event topic in the receipt exactly):
        `0xf2716ccc53eb7816e23600d4f47fb6a4a5ea0fb5b8748f9743207138dda3e974`.
        28-day duration (`V2_REGISTRATION_DURATION`, matching
        `MIN_REGISTER_DURATION` from E2), paid in MockUSDC, 613,701 base /
        0 premium. Expiry, read via `ETHRegistry.findExpiry("autorenewdemo")`
        after the register confirmed, not assumed from the duration alone:
        `1795554180` (2026-11-24T21:03:00Z). The HCA account
        (`0xe4F6BB...031F`) is the session this name's eventual auto-renew
        runs through; the EOA deployer is its registry-owner, for the
        `NoNFTAllowed` reason above.

        The commit secret for both attempts was `bytes32(0)` (`zeroHash`),
        the same convention this project's own
        `script/migrations/smoke.ts` `registerViaV2Registrar` helper uses —
        not a private value that exists only in this session. Every
        `register`/`makeCommitment` parameter is written above and in
        `config/networks.ts`'s `demoName`, so the exact call is reproducible
        by reading either file; nothing here depends on state that only
        exists in a running session. `DECISIONS.md` D10 and
        `THREAT-MODEL.md` section 3.4 now record the `NoNFTAllowed`
        architecture conclusion the owner asked for.
        Recorded in `config/networks.ts`: `ourStack.DemoAccount` and a new
        `demoName` field (with a doc comment explaining the owner/account
        split, so nothing downstream re-makes the same wrong assumption E6.5
        did on the first attempt), plus
        `contracts-v2/contracts/deployments/sepolia-autorenew/DemoAccount.json`
        and `demoName.json`. `deployments/sepolia/` untouched throughout.
        E7 now has its account and its name; only the renewal transaction
        itself remains, gated on demo item O1 (the operator's submit code).
        Method: every call simulated with `cast call` or read from source
        before sending where failure was plausible (the predicted account
        address, the commitment hash, the price quote); every transaction
        independently re-verified on chain after sending
        (`hcaOwners`, `isAvailable`), not taken from `cast send`'s own
        printed receipt alone.
- [x] E7. GATED. Record the transaction hashes for setup and one renewal.
      These are the public evidence.
      2026-10-27, DONE: the manager fired the renewal directly, against the
      live private stack E6/E6.5 built, after contracts C6/C7 and a clean
      eth_call simulation. Every number below was independently re-read on
      chain by this beat before being written down — none of it taken on
      the manager's report alone, the same standard as every other entry
      in this file.

      THE RENEWAL: tx
      `0x5c8e9a9d1b3a7ba0235377c85f251e9dad40a2900dd206b7341a96fa7051eb95`.
      Re-read via `cast receipt`: status 1 (success), block 12,008,109,
      gasUsed 370,240, `from` the deployer EOA, `to`
      `0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF` (the Rhinestone
      IntentExecutor proxy), 6 logs — all four numbers matched the
      manager's report exactly. The call's actual selector, read from the
      transaction's own input data (`cast tx ... input`), is `0x8f5c3522`.
      Computed independently from Rhinestone's own ABI
      (`@rhinestone/shared-configs`'s `orchestrator.js`, not guessed):
      `executeSinglechainOps((address,uint256,(bytes),bytes))` hashes to
      exactly `0x8f5c3522`, confirming this was the plain, no-refund entry
      point, not `executeSinglechainOpsWithGasRefund_ERC20`.

      THE EXPIRY: `ETHRegistry.findExpiry("autorenewdemo")`, re-read fresh
      this beat, now returns `1827111780`. E6.5 recorded the pre-renewal
      value as `1795554180`. The delta is `31557600` seconds exactly —
      `DECISIONS.md` D9's fixed renewal duration, to the second.

      THE SETUP TX: tx
      `0xeb9820aeee6ebd5834e6773a8b9c08271056e75342a206ba9fab6c11e608116b`.
      Re-read via `cast receipt`: status 1, block 12,008,103, `from` the
      deployer EOA, `to` MockUSDC. Decoded the `Approval` log directly
      (not assumed from the summary): spender
      `0xe4F6BBcf33656d55Cc50Cf2FAD344C208243031F` (the HCA account),
      amount `16011002`. This is the feature's own setup step, not an
      incidental fix: the owner must grant the HCA account an allowance
      before any renew session can pull funds, and this is that grant.

      THE TWO NUMBERS THAT MATTER MOST, both re-read fresh on chain, not
      inferred from the setup tx's log alone:
      - `allowance(owner, HCA account)` now returns `8005501`. Was
        `16011002` right after the setup tx (read from its own log, above).
        The decrease, `8005501`, is the ERC-20 allowance acting as the
        period cap, per `DECISIONS.md` D6 — the renewal call can only ever
        move what the owner has standing-approved, never more.
      - `balanceOf(owner)` on MockUSDC now returns `991380798`. E6.5
        recorded it as `999386299` right after registration. The decrease
        is also exactly `8005501` — the same number, independently, from
        the other side of the transfer. The money moved from the owner's
        wallet, never from the HCA account's own balance (the HCA holds no
        funds of its own in this flow).
      - Cross-checked a third way: `getRegisterPrice`'s companion,
        `getRenewPrice("autorenewdemo", 31557600, MockUSDC)`, queried fresh
        this beat, returns `8005501`. The 2x headroom in the setup
        allowance (`16011002 = 2 x 8005501`) is `DECISIONS.md` D9's
        max-spend rule, exactly as specified, not approximated.

      THE VALIDATOR: traced the renewal transaction
      (`cast run <tx> --rpc-url $SEPOLIA_RPC_URL`) rather than re-calling
      `isValidSignature` cold with no signature to hand. The trace shows
      the ERC-4337 validation chain running through
      `0x8012Aa1a220F34f519A902C8f446823E0Dd363E5` — this project's own
      patched `HCAOwnerAndSessionValidator` from E6, not ENS's
      `0x4bf64159...` — via `isValidSignatureWithSender`, returning
      `0x1626ba7e` (the ERC-1271 magic value) at every level of the call
      stack up to the orchestrator. The patched renew rule ran, and it
      passed, on a real transaction, not a simulation.

      Full address/tx record already lives in `config/networks.ts`
      (`ourStack`, `demoName`) and `contracts/deployments/sepolia-autorenew/`
      from E6/E6.5; this entry adds the renewal and setup tx hashes next to
      them in prose, since neither file has a natural slot for "the one
      renewal" as a standalone field. `STATE.md` updated to match.
      Method: `cast receipt`/`cast tx`/`cast call` for every number, one
      `cast run` trace replay for the validator claim, one independent ABI
      lookup (Rhinestone's own package, not this project's) to confirm the
      selector — nothing in this entry rests on the manager's numbers alone.

      Superseded history below (how E7 got to BLOCKED, then closed):
      2026-10-27, BLOCKED, for a reason the ledger does not anticipate. The
      "setup" half could be satisfied today from E6 (the five `ourStack`
      deploy txs) or E5 (the two mints) depending how "setup" is scoped —
      not written as done here because "one renewal" is the half that
      actually proves the feature, and it has no path to a real transaction
      yet, for reasons that are not quick fixes:

      1. The code to build and submit a renewal does not exist. Read
         `operator/core.ts` in full: its own header says "Scope for now:
         read the expiry, decide whether a name is due. Building and
         submitting the renewal call... come later (ERD.md 7.2 steps
         3-5) — they need the contract change, which is still gated behind
         progress/contracts.md C1." C1 is now done (E6's gate), but nobody
         has gone back and written the "come later" part; `core.ts` only
         has `decideWindow`/`readExpiry`. There is no function anywhere in
         this project that assembles or sends a renewal call.
      2. No HCA account exists yet. E6 deployed the FACTORY and
         IMPLEMENTATION, not an account instance. Nothing has called
         whatever `createAccount`-equivalent function the private factory
         exposes.
      3. No name is registered to, or controlled by, any such account.
         Registering one for real costs ~8 USDC/DAI-equivalent (VERIFY.md
         5's pricing) in payment tokens this project does have (E5), plus a
         real commit/reveal cycle (`MIN_COMMITMENT_AGE` 60s, `VERIFY.md` 1)
         — doable, but it is new real transactions this item's text does
         not mention, not just "recording."
      4. Two design decisions the project itself still lists as open would
         parameterize whatever policy/session gets attached to that
         account: `STATE.md`'s own "Open decisions" — default values for
         the two caps (`THREAT-MODEL.md` section 8) — and `STATE.md`'s
         "Next" item — fixed vs. capped duration (`ERD.md` 3.4.2,
         `DECISIONS.md` D4). Picking values for either on my own, just to
         get a renewal to fire, would mean the "public evidence" this item
         produces embeds an unreviewed policy choice. Not done without a
         decision.

      Not attempted: writing the operator's missing renewal-submission
      code, choosing the two open parameters, or creating an account and
      registering a name to it, all in one heartbeat, right after being
      corrected this session for not thinking a deploy's side effects
      through carefully enough. Each of 1-4 is real, separate work, not a
      quick unblock.

      WHAT WOULD UNBLOCK: the operator or a future beat (a) writes the
      renewal-building code against the now-live private stack, (b) picks
      the two open parameters (or confirms a placeholder is acceptable for
      a demo, explicitly), then (c) creates an account, registers a name to
      it, and triggers one real renewal — in that order. None of it
      started this beat beyond identifying exactly what is missing.
      Method: read `operator/core.ts`, `operator/node.ts`'s and
      `operator/worker.ts`'s absence of any send-path (both just wire
      `core.ts` to a clock/RPC, confirmed by file length alone — 94 and 89
      lines, no room for a full registration+session+renewal flow), and
      `DECISIONS.md`'s D4/D7 headings plus `STATE.md`'s own "Open
      decisions" section, not guessed.
- [x] E8. Keep STATE.md current at the end of every beat that changed anything.
      2026-10-27, closed per the manager: `STATE.md` has been updated at
      the end of every beat this session that changed a file, from E1
      through E7. This is a standing practice, not a one-time deliverable
      — marking it done records that it has been followed throughout, not
      that it stops mattering now. `STATE.md` is current as of this beat's
      E7 close.
- [x] E9. NOT GATED. Added by the manager 2026-10-27, after contracts C8
      measured that `autorenewdemo` has no resolver, so the fallback demo
      cannot run on it. Deploy a conforming resolver (a `VerifiableFactory`
      proxy of `PERMITTED_RESOLVER_IMPL`), set it on the name, grant the HCA
      account `ROLE_SET_ADDRESS`, and re-run the `isValidSignature` probe
      with a proof naming it.

      ROUTE CHECK, per C8 section 5, done before touching anything: the
      HCA's own factory-deploy path would have granted the role
      automatically, through the resolver's own initializer, IF the name
      had been registered through the HCA. `autorenewdemo` was registered
      directly by the EOA (E5/E6.5, before the `NoNFTAllowed` finding was
      even made), so there is no HCA-deployed resolver and no automatic
      grant — confirmed again this beat, `getResolver("autorenewdemo")`
      still returned `address(0)` before starting. Used the manual route:
      deploy directly, `setResolver`, then grant by hand. Not the
      session-driven deploy route, which is real feature work (assembling
      a `deployProxy` execution inside a signed batch matching
      `checkDeployment`'s exact shape) that this item's text did not ask
      for and was not built.

      1. DEPLOYED the resolver: `VerifiableFactory.deployProxy(implementation,
         salt, initData)` on `0xda70306c98e97ece36f997a21368e53298572991`
         (the real, shared `VerifiableFactory` — reused, not redeployed,
         same pattern as E6), `implementation = PERMITTED_RESOLVER_IMPL =
         0x115eb53F0c60696633855F90b138178Fb40b2b2C`, `salt = cast keccak
         "autorenewdemo-resolver"`, `initData =
         initialize([(deployerEOA, ALL_ROLES)], [])` (`ALL_ROLES` read
         verbatim from `EACBaseRolesLib.sol`, not retyped from memory;
         grants are on `ROOT_RESOURCE`, confirmed by the emitted
         `RolesGranted`-shaped log's own topic). Address predicted with
         `predictProxyAddress` and confirmed with a `cast call` simulation
         before sending, same discipline as E6/E6.5. Resolver:
         `0xF26C66e16584BFfD88F72b45Bc9C1e4dFab3A549`, tx
         `0x2cdedab70e9ca8251bdb9d578db3d03bee15e2ff61b69d4b7758acb9fdd69fa3`,
         block 12,008,185. Re-read after: `hasRoles(0, ALL_ROLES,
         deployerEOA)` on the new resolver returns `true`.
      2. SET IT ON THE NAME: `ETHRegistry.setResolver(tokenId, resolver)`
         on `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4`. Simulated first,
         sent: tx
         `0x8998f781c7b9f7031add23c6ee9c0c01dadb0048ddaf8bd9ce0fb954dbc77be1`,
         block 12,008,188, status 1. Re-read: `getResolver("autorenewdemo")`
         now returns `0xF26C66e16584BFfD88F72b45Bc9C1e4dFab3A549`.
      3. GRANTED THE ROLE — and found a real correction to C8 section 4 in
         the process, not just followed it. `grantRoles(resource(60), 1,
         HCA)`, simulated first via `cast call`, reverted
         `EACCannotGrantRoles`. Read the source rather than guessing why:
         `PermissionedResolver.sol` line 297 OVERRIDES
         `EnhancedAccessControl.grantRoles` with a version that is `pure`
         and unconditionally reverts `EACCannotGrantRoles` — C8 section 4
         read only the base `EnhancedAccessControl` declaration and never
         called `grantRoles` live against an actual resolver instance, so
         it missed the override. The real entry point is
         `grantSetterRoles(bytes setter, address account)`
         (`decodeSetter` extracts the role/resource from the setter's own
         shape, so the caller cannot specify an arbitrary pair). Built
         `setter` as the exact calldata shape of
         `setAddress(bytes,uint256,bytes)` with coinType `60` (name and
         value content do not affect the decode). Simulated, then sent:
         `grantSetterRoles(...)` on the resolver, tx
         `0xaa06c2e4eb13121b5ab48d3f8c0835832b72a57daee58db6d47e10da4ec61c1b`,
         block 12,008,201, status 1. Re-read: `hasRoles(resource(60), 1,
         0xe4F6BBcf33656d55Cc50Cf2FAD344C208243031F)` on the resolver
         returns `true`. `VERIFY.md` item 3 point 4 has the full
         correction; this is the live measurement behind it.
      4. RE-RAN THE PROBE. `operator/c8-probe.ts` (read-only, contracts'
         own tool from C8) had `RESOLVER_IMPL` set to a placeholder —
         `StandaloneHCAImplementation`, not a resolver at all, flagged by
         C8 itself as inconclusive. Updated the one constant to the real
         resolver address above and re-ran, nothing else touched:
         ```
         A  resolver=0, setAddress            : REFUSED  error=Execution reverted for an unknown reason.
         B  resolver=named, setAddress        : ACCEPTED 0x1626ba7e
         ```
         Case B is the answer: `0x1626ba7e`, the ERC-1271 magic value,
         for a `setAddress` execution under a session whose proof names
         the real conforming resolver. The fallback leg is reachable. One
         note on case A's exact shape, not a contradiction of C8: this
         probe calls the validator directly (`isValidSignatureWithSender`
         on `0x8012Aa1a...`), which does not catch internal reverts the
         way the account wrapper does, so the refusal surfaces as a
         revert here rather than a clean `0xffffffff` return; same
         conclusion, different observable shape, recorded in `VERIFY.md`
         item 3 so nobody is confused by the difference later.

      Recorded in `config/networks.ts`: `ourStack.DemoResolver` and
      `demoName.resolver`/`demoName.resolverGrantedSetAddress`, plus
      `contracts/deployments/sepolia-autorenew/DemoResolver.json` and
      `resolverGrant.json`. `deployments/sepolia/` untouched throughout.
      Method: every address and amount simulated with `cast call` before
      sending; every resulting state (`hasRoles`, `getResolver`) re-read
      fresh after sending, not assumed from a receipt; the probe re-run
      is the actual script contracts left in place for this purpose, with
      one constant corrected, not a new script built from scratch.
