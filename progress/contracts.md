# contracts — progress ledger

One beat does ONE unchecked item, then stops. Do not run ahead.
Mark an item `[x]` only when it is done and verified. Add a dated note under it.

## Setup
- [x] S1. Read PRD.md, ERD.md sections 3 and 4, AGENTS.md. Load the ensv2 skill.
      2026-10-22: Read `PRD.md` (all 9 sections), `ERD.md` lines 27-162
      (section 3 Contract change, 3.1-3.5, and section 4 Test matrix),
      `AGENTS.md`, and `STATE.md`. Loaded the ensv2 skill by reading
      `.claude/skills/ensv2/SKILL.md` from disk; the Skill tool does not list
      it, because the session working directory is the agent workspace, not
      this project. Content loaded is the same file.
      Carried forward for the next beats:
      - Change site is `contracts/src/hca/HCAOwnerAndSessionValidator.sol`,
        if-chain near line 660. Add a case for `IETHRenewer.renew.selector`.
      - Registrar check is `_isAuthorizedRegistrar(execution.target, state)`.
        No hardcoded renewer address.
      - Owner binding reads the label from call data, `LibLabel.id(label)`,
        then `latestOwnerOf`. Not `ownerOf`: it fails inside grace.
      - Two caps: `maxDurationPerRenewal` (seconds) and `maxSpendPerPeriod`
        (payment token). ERD 3.4.2 recommends fixed duration, capped spend.
        That is R1, still open.
      - Must not change: the initial implementation, the existing rules,
        `HCAResolverPolicyLib`.
      - Tests run on a Sepolia fork against deployed contracts, `vm.warp`
        for expiry. Test 6 is the strongest.
- [x] S2. Start anvil forking Sepolia from $SEPOLIA_RPC_URL. Confirm chain id
      11155111 and that ETHRegistrar at the config address has code.
      2026-10-22: Anvil 1.5.0-stable forks Sepolia from $SEPOLIA_RPC_URL
      (read from `.env`, never echoed). Fork block 11971358. Log at
      `/tmp/auto-renew-anvil-sepolia-8546.log`.
      Verified on the fork, not from an ABI:
      - `cast chain-id` returns 11155111. A fork keeps the forked chain id.
      - ETHRegistrar `0xf633e7fc...a3d3` has 8037 bytes of code.
        `GRACE_PERIOD()` = 2419200. `MIN_REGISTER_DURATION()` = 2419200.
        Both match `config/networks.ts` and STATE.md.
      - ETHRenewerV1 `0xf2ece449...e045`: 6979 bytes, `GRACE_PERIOD()` =
        7776001. HCAOwnerAndSessionValidator `0x4bf64159...0466`: 19743 bytes.
      PORT DEVIATION. The fork runs on **8546**, not 8545. Port 8545 is held
      by an unrelated anvil (pid 89631, started 2026-09-10, `--chain-id 31337
      --timestamp 1800000000`, no ENSv2 code at any config address). It is not
      this project's process, so this beat did not kill it. Consequence for
      the demo track: `LOCAL_RPC_URL` in `.env` and `ERD.md` line 214 both say
      8545. Either free 8545 before the frontend work, or change those two
      references. Not changed here; it is outside this item.
- [x] S3. Move test/AutoRenewPolicy.t.sol into the clone test tree. Make it
      compile as an empty skeleton. No cases yet.
      2026-10-22: Done. The file now lives at
      `contracts-v2/contracts/test/unit/hca/AutoRenewPolicy.t.sol`. It is a
      move, not a copy: `/Users/oakgroup/auto-renew/test/` no longer
      exists. The placement happened at the end of the previous beat, which
      was cut off before it marked the ledger; this beat verified it.
      Verified with forge 1.5.0-stable, run in
      `contracts-v2/contracts` on clone commit `3e54cdb8` (`post-audit-2`):
      - `forge build` -> "No files changed, compilation skipped". The artifact
        `out/AutoRenewPolicy.t.sol/AutoRenewPolicyTest.json` exists, so the
        file did compile; it is not skipped for being unseen.
      - `forge test --match-path test/unit/hca/AutoRenewPolicy.t.sol -vv` ->
        "0 passed; 0 failed; 9 skipped". Every case carries `vm.skip(true,
        "Tn not written")`, so the empty skeleton reports SKIP, not a false
        green. This is the state the item asks for.
      - `forge fmt --check` on the file exits 0.
      No cases written, as the item requires. No contract touched.

## The rule
- [x] R1. Decide ERD 3.4.2: fixed duration or capped duration. Record as D4 in
      DECISIONS.md with the reason. Decide before writing the rule.
      2026-10-22: DECIDED. Fix the duration, cap the spend. Recorded as D4 in
      `DECISIONS.md` with reason, evidence and four consequences. This is the
      ERD 3.4.2 recommendation; the evidence below supports it rather than
      just restating it.
      Read on clone commit `3e54cdb8` (`post-audit-2`):
      - `IETHRenewer.renew(RenewData, IERC20 paymentToken)`. `RenewData` holds
        `uint64 duration`, caller-supplied, so the validator must bind it.
      - No year constant exists in `src/`. `grep` for `365 days`, `31536000`,
        `31557600` and `ONE_YEAR` returns nothing. "One year" is our policy
        number, not the protocol's.
      Three consequences land on later items. Read D4 before R3 and T3:
      - R3 writes ONE fixed `renewalDuration`, not a maximum. `ERD.md` 3.4
        calls the field `maxDurationPerRenewal`; that name is now wrong and
        R3 must patch it.
      - T3 changes shape. A fixed value means any unequal duration reverts,
        BELOW the value as well as above. Test both directions, not just
        "above the bound" as the T3 item reads.
      - `renew` takes the payment token as a parameter, so a stolen key can
        choose it. A cap in one token does not bind a call paying in another.
        USDC and DAI are both accepted (`VERIFY.md` 5), so this is reachable.
        R3 must fix the token or hold a per-token cap.
      Unverified, found while deciding: the 28-day `MIN_REGISTER_DURATION`
      check sits in `_requireAvailable`, a REGISTER path. A renewal floor is
      not confirmed, though `IETHRenewer` declares `DurationTooShort`. Confirm
      before T3. Do not claim renewal has a 28-day minimum.
- [x] R2. Add the renew case to the if-chain in
      contracts/src/hca/HCAOwnerAndSessionValidator.sol. Registrar via
      _isAuthorizedRegistrar. Owner via latestOwnerOf.
      2026-10-22: BLOCKED. The code is written and it builds. The item's
      registrar check, taken literally, refuses the only renewal path that
      exists today. An operator decision is needed. Nothing is lost; do not
      redo the code.
      WHAT IS IN PLACE (clone commit `3e54cdb8`, file now modified):
      - A `renew` case in the if-chain of `_checkRegistrationExecutions`,
        placed after the `register` case. It calls
        `_isAuthorizedRegistrar(execution.target, state)` and reverts
        `ActionNotAllowed` on failure, then requires
        `_renewLatestOwner(execution.callData) == owner` and reverts
        `PolicyRuleFailed` on mismatch.
      - A new helper `_renewLatestOwner`, next to `_registerFields`. It
        decodes the renew tuple with `HCAExecutionLib.callArgs` plus
        `abi.decode(..., (RenewData, IERC20))`, then reads
        `IPermissionedRegistry(ETH_REGISTRY).latestOwnerOf(LibLabel.id(label))`.
        A full decode, not fixed ABI offsets, because `label` is a dynamic
        string and its position is not fixed. A malformed tuple reverts inside
        `abi.decode`, which refuses the call.
      - Three imports added: `IETHRenewer, RenewData`, `IPermissionedRegistry`,
        `LibLabel`.
      - `forge fmt` applied. `forge build` -> "Compiler run successful!",
        6 files recompiled. No existing rule altered, no initial
        implementation touched, `HCAResolverPolicyLib` untouched.
      THE BLOCKER, verified on the Sepolia fork at 127.0.0.1:8546, chain id
      11155111, addresses read from `config/networks.ts`:
      - `_isAuthorizedRegistrar` resolves to
        `HCARegistrarPolicyLib.isAuthorized`, which checks exactly one role:
        `hasRootRoles(ROLE_REGISTRAR, account)`, where `ROLE_REGISTRAR` is
        `1 << 0` (`RegistryRolesLib.sol` line 9).
      - `ETHRegistry.hasRootRoles(1, ETHRenewerV1)` returns **false**.
      - `ETHRegistry.hasRootRoles(65536, ETHRenewerV1)` returns **true**.
        `65536` is `ROLE_RENEW`, `1 << 16`, line 29.
      - `ETHRegistry.hasRootRoles(1, ETHRegistrar)` returns true, and
        `hasRootRoles(65536, ETHRegistrar)` returns true. ETHRegistrar holds
        both roles; ETHRenewerV1 holds only RENEW.
      - Both contracts answer `supportsInterface(0x37e6a567)` true, so both
        expose `IETHRenewer`. The selector in the new case is
        `IETHRenewer.renew.selector`; `cast sig
        "renew((string,uint64,bytes32),address)"` gives `0x2d06649b`.
      CONSEQUENCE. The rule as specified permits a renewal through
      `ETHRegistrar` and refuses one through `ETHRenewerV1`. Per `VERIFY.md` 6
      and `STATE.md`, renewal today goes through `ETHRenewerV1`, and
      ETHRegistrar renewal opens at rollout Stage 4. So T1, the PASS case,
      cannot pass against the live renewal path with this check. ERD 3.4.1
      already records ETHRenewerV1 with registry-wide RENEW, so the ledger
      names the right contract and the wrong role check.
      THE DECISION, for the operator. Not improvised here:
      (a) keep `_isAuthorizedRegistrar` and accept that the rule covers only
          the Stage 4 ETHRegistrar path, and re-point T1 at it; or
      (b) add a renew-specific authority check on `ROLE_RENEW` for the renew
          case only, leaving `_isAuthorizedRegistrar` untouched for register;
          or
      (c) accept either role for the renew case.
      Option (b) matches ERD 3.4.1's authority distinction most closely, and
      it touches no existing rule. It is not written, because the item says
      `_isAuthorizedRegistrar` and changing that is a different task.
      Also note for T7: "unauthorized registrar" now has two meanings, a
      contract with neither role and a contract with only one. Test both.
      DECIDED 2026-10-22 by the owner: OPTION (b). You are unblocked.
      Add a renew-specific authority check. For the renew case only, require
      the target to hold ROLE_RENEW (1 << 16) on the registry root, via the
      same hasRootRoles path HCARegistrarPolicyLib.isAuthorized uses. Do NOT
      change _isAuthorizedRegistrar; register and commit keep it unchanged.
      Reason: the validator must ask the same question the registry asks. The
      registry gates renewal on ROLE_RENEW, so the policy check must test
      ROLE_RENEW. Checking ROLE_REGISTRAR asks a different question and gets
      the wrong answer for ETHRenewerV1, which is the bug you found. Option
      (a) ships a rule that cannot work until Stage 4. Option (c) widens the
      policy surface for no functional gain, since the registry would reject
      a REGISTRAR-only contract anyway.
      Keep the symmetry: register checks the role register needs, renew checks
      the role renew needs. It is a role query, not an address, so it survives
      ENS redeploying either contract.
      Update ERD 3.2 and 3.3 to say ROLE_RENEW for the renew case, and record
      this as D5 in DECISIONS.md.
      For T7, test both meanings you identified: a target with neither role,
      and a target with ROLE_REGISTRAR but not ROLE_RENEW.
      2026-10-22, after the decision: DONE. Option (b) is implemented.
      - `HCARegistrarPolicyLib.isRenewAuthorized(registry, account)` added,
        beside `isAuthorized`. It calls
        `hasRootRoles(RegistryRolesLib.ROLE_RENEW, account)`, the same
        `hasRootRoles` path `isAuthorized` uses.
      - `_isAuthorizedRenewer(address)` added to the validator, beside
        `_isAuthorizedRegistrar`. It returns false for the zero address, then
        defers to the library.
      - The renew case now calls `_isAuthorizedRenewer(execution.target)`.
      - `_isAuthorizedRegistrar` is UNCHANGED. Verified by call site: lines
        569 and 576 (commit, register) and 699 (payment-token approval) still
        call it. Only line 591, the renew case, calls the new check.
      - `_isAuthorizedRenewer` deliberately does NOT pin the target into
        `state.authorizedRegistrar`. That slot selects the one registrar a
        batch may register through. A renewer is a different contract from the
        registrar, so sharing the slot would refuse a batch that registers and
        renews. The reason is in the NatSpec.
      Verified: `forge fmt` applied to both files, then `forge build` ->
      "Compiler run successful!", 6 files recompiled. No test run yet; the
      cases are still skeletons, so T1 to T9 remain the proof.
      Recorded: D5 in `DECISIONS.md`, with the on-chain role table.
      `ERD.md` 3.2 and 3.3 patched to say `ROLE_RENEW` and to name
      `_isAuthorizedRenewer`. 3.2 now also states the symmetry rule and warns
      against calling `_isAuthorizedRegistrar` for renew.
      Carried to T7: no deployed Sepolia contract has ROLE_REGISTRAR without
      ROLE_RENEW, because `ETHRegistrar` holds both. The second T7 case needs
      a mock. Recorded as D5 consequence 3.

- [x] R3. Add the duration bound and spend cap to the session data, per D4.
      2026-10-22: PARTIAL. The session data carries the caps. Enforcement is
      not written. Resume at "WHAT REMAINS".
      DONE, builds clean (`forge build` -> "Compiler run successful!", 5 files):
      - `SessionEnableProof` has three new fields, appended after
        `sessionToEnableIndex`: `address renewPaymentToken`,
        `uint64 renewalDuration`, `uint96 maxRenewSpend`.
      - Per D4 the duration is FIXED, not a maximum, so the field is
        `renewalDuration`, not `maxDurationPerRenewal`.
      - `_SESSION_PROOF_HEADER_LENGTH` 110 -> 150. The three fields add 40
        bytes: 20 + 8 + 12. New packed offsets, relative to `proofOffset`:
        `renewPaymentToken` 109:129, `renewalDuration` 129:137,
        `maxRenewSpend` 137:149. `chainCount` moves from byte 109 to byte 149,
        which the `HEADER_LENGTH - 1` read follows automatically.
      - `_decodeSessionEnableProof` reads the three new slices.
      - `_sessionAuthorizationSalt` now hashes all three, so the owner's
        signature binds the caps. A stolen key cannot restate them.
      DECIDED here, which D4 consequence 3 left to R3: FIX the payment token.
      The rule holds one `renewPaymentToken`, not a cap for each token.
      Reason: `renew` takes the token as a parameter, so a stolen key would
      otherwise pay in a token the cap does not bind. A per-token cap needs a
      dynamic array, and this proof is a fixed-length packed layout. The owner
      knows the funding token at install, so fixing it costs nothing. This
      matches D4's "fixed value where the owner can know it".
      WHAT REMAINS, in order:
      1. Thread the caps into `_checkRegistrationExecutions`. It does not
         receive the proof today; its parameters are `(account, owner,
         allowedResolver, executions, gasRefund, fundingToken,
         requireAction)`. Add one struct parameter rather than three scalars.
         Call sites to update: `_checkStatelessRegistrationPolicy` and any
         other caller. Grep `_checkRegistrationExecutions` before editing.
      2. In the renew case, add three checks after the owner binding:
         - `rd.duration == proof.renewalDuration`, else `PolicyRuleFailed`.
         - `paymentToken == proof.renewPaymentToken`, else `PolicyRuleFailed`.
           The decoded tuple already yields the token; `_renewLatestOwner`
           discards it today, so return it or decode once and pass both.
         - price <= `proof.maxRenewSpend`. Read the price with
           `IETHRenewer(execution.target).getRenewPrice(rd.label, rd.duration,
           paymentToken)`. Precedent for an oracle read inside validation:
           `HCARegistrarPolicyLib.isPaymentToken` already calls the
           registrar's oracle provider.
      3. Set the number for `renewalDuration` and justify it, plus the spend
         cap, in `THREAT-MODEL.md` section 8. Ground the spend on the verified
         price: one year on a nine-character name costs 8.0055 USDC, the same
         on both networks (`ERD.md` 6.4, `VERIFY.md` 5). No year constant
         exists in the contracts, so the duration is our policy number (D4).
      4. Patch `ERD.md` 3.4. It still names `maxDurationPerRenewal` and says
         two maxima. D4 consequence 1 requires the rename.
      OPEN QUESTION for the operator. Do not improvise it.
      `ERD.md` 3.4 says "reject a call that takes the PERIOD spend above the
      second cap". A period accumulator needs storage. This validator is
      stateless: its checks are `internal view`, and `isInitialized` is
      `pure`. So a running total for a period cannot be enforced here.
      What IS enforceable statelessly is a PER-CALL cap: this one renewal must
      cost at or below `maxRenewSpend`. Step 2 above writes that.
      The gap this leaves: a stolen session key can call renew repeatedly,
      each call inside the per-call cap. The name is never lost, because every
      renewal extends the expiry, but the funding balance can be drained in
      units of one renewal. That is the real blast radius and THREAT-MODEL 3
      must state it, not the cap alone.
      Three ways to close the gap, none written:
      (a) accept the per-call cap, and state the drain in the threat model;
      (b) bound the funding instead, by capping the ERC-20 approve in the
          batch, which is where the money actually moves;
      (c) give the validator storage for period accounting, which changes its
          stateless design and needs an escalation per AGENTS.md.
      WATCH OUT. The proof encoding changed, so every existing test that
      builds a 110-byte proof header now builds a short proof and decodes to
      zero. `test/unit/hca/HCAOwnerAndSessionValidator.t.sol` and
      `StandaloneSingleOwnerHCA.t.sol` are the likely ones. Their proof
      builder must move to 150 bytes. NOT CHECKED YET; the existing suite was
      not run this beat. Run it before R4, because R4 is "forge build clean"
      and a green build can still hide a red suite.
      2026-10-22, second pass on R3. The WATCH OUT was real and is now
      MEASURED. The existing suite is RED and it is my change that did it.
      Do not treat the tree as clean until this is fixed.
      Baseline, measured by stashing the three modified files and running at
      commit `3e54cdb8`: `test/unit/hca/HCAOwnerAndSessionValidator.t.sol`
      gives 20 passed, 0 failed. The stash was popped and all work is
      restored; `git status` shows the three modified files plus the untracked
      `AutoRenewPolicy.t.sol`.
      With the R3 encoding change: 16 of those 20 fail. Every failure is
      `InvalidSessionData()`, which is the decoder bailing, not a policy
      refusal. `forge build` is still clean, which is exactly why R4 must not
      be read as proof of anything. The other four hca suites stay green;
      across `test/unit/hca/*` the count is 108 passed, 16 failed, 9 skipped.
      Already tried, and NOT sufficient: `SessionEnableProofFixture` and
      `_packProof` in that test were updated to emit the three new fields, so
      the packer now writes 149 field bytes plus the `chainCount` byte, which
      is the 150 the decoder wants. The 16 failures did not move.
      Ruled out: there is only one `_packProof`, used at three call sites, so
      a second builder is not the cause. The `assertEq(claimData.length, 410)`
      in the trace is Permit2 claim data, not proof data. It is a red herring.
      BEST LEAD for the next beat, not yet verified. `_sessionAuthorizationSalt`
      now hashes `renewPaymentToken`, `renewalDuration` and `maxRenewSpend`.
      The test computes its own salt and derives `permissionId` from it near
      lines 785 and 797. The test's salt no longer matches the validator's, so
      the derived `permissionId` diverges and the enable path rejects the
      proof. Mirror the three new fields into the test's salt computation and
      re-run. Check the same mirroring in any other suite that builds a
      session proof.
      Second lead, if the salt is not it: the `tailLength` arguments passed to
      `_decodeSessionEnableProof` at lines 325 and 391, and the constant
      `FIXED_SESSION_REFUND_ENABLE_FIELDS_LENGTH = 82`. All failures enter
      through `HCAOwnerAndSessionValidatorEnableHarness.isValidSignatureWithSender`.
      The open question on the spend cap is still unanswered, so steps 2c and
      3 of "WHAT REMAINS" stay untouched. Steps 1, 2a, 2b and 4 do not depend
      on it, but fixing this red suite comes first. A cap enforced on top of a
      broken decode proves nothing.
      DECIDED 2026-10-22 by the owner. The (a)/(b)/(c) question is WITHDRAWN.
      None of the three. The premise was wrong and the owner corrected it.

      THE MODEL. No funds park anywhere. Money comes from the OWNER'S WALLET,
      only up to an ERC-20 allowance the owner granted, and passes through the
      HCA inside ONE atomic batch:
        1. paymentToken.transferFrom(wallet -> HCA, exact quoted price)
        2. paymentToken.approve(registrar, exact quoted price)
        3. registrar.renew(...)
      HCA balance before the batch: zero. After: zero.

      CONSEQUENCE FOR THE CAP. The ERC-20 allowance IS the period cap. It is
      stateful and the token contract decrements it on every transferFrom, so
      it enforces for free exactly what this stateless validator cannot. Do
      not build period accounting. Do not add storage. Keep the per-call
      bound you already wrote as a sanity check on a single call, and stop
      there.

      WHAT TO ENFORCE in the renew case, all stateless:
      - The batch pulls the EXACT quoted price. Not more. No over-funding and
        no residue left in the HCA. ENS's registration route deliberately
        over-funds and leaves the remainder; renewal must not copy that.
      - Any approve in the batch is to the selected registrar and for that
        same exact amount.
      - The transferFrom source is the owner's wallet, destination the HCA.

      BLAST RADIUS, for THREAT-MODEL.md section 3. A stolen session key can
      spend at most the REMAINING ALLOWANCE, on renewals of names the owner
      already holds. It cannot raise the allowance; only the owner can. The
      money goes to the ENS beneficiary, so the attacker receives nothing and
      the owner receives name-years. revokeSessions() ends it in one
      transaction. State this with the allowance named as the bound.

      Also patch ERD.md 3.4: replace "maximum spend for each period" with the
      allowance model above, and record this as D6 in DECISIONS.md.
      2026-10-22, third pass on R3. The red suite is FIXED and the owner's
      two document asks are done. Enforcement is still not written.
      RED SUITE FIXED, and the cause was the best lead in the note above.
      `_sessionAuthorizationSalt` now hashes the three new fields; the test
      computed its own salt from the old seven and derived `permissionId`
      from it, so the ids diverged and the enable path refused the proof.
      Mirrored the three fields into the test's salt, near line 633. No other
      change was needed; the `_packProof` fix from the second pass was
      necessary but not sufficient.
      Verified: `forge test --match-path 'test/unit/hca/*'` gives 124 passed,
      0 failed, 9 skipped. The 9 skips are the AutoRenewPolicy skeleton. The
      baseline for the one suite I broke was 20 passed, 0 failed, and it is
      now 20 of 20 again inside that total. The tree is green.
      DONE for the owner's asks:
      - `ERD.md` 3.4 rewritten. It now names the three fields from D4, says
        the duration is fixed and not a maximum, and carries the allowance
        model with the three-step batch and the "no period accounting, no
        storage" instruction. The D4 consequence 1 rename is therefore closed.
      - D6 recorded in `DECISIONS.md`, with the batch, the reason the premise
        was wrong, and the blast radius for THREAT-MODEL 3.
      NEW FINDING, and it needs an owner decision before step 2 of the batch
      can validate. Step 2 is `paymentToken.approve(registrar, price)`. The
      if-chain already has a rule for an approve: `_checkPaymentTokenApproval`.
      That rule accepts a spender only when
      `_isAuthorizedRegistrar(spender, state)` is true, or when the spender is
      `GAS_REFUND_PAYMASTER`. Per D5, `ETHRenewerV1` does NOT hold
      `ROLE_REGISTRAR`. So an approve to the renewer falls through both
      branches and reverts `PolicyRuleFailed`. The owner's batch cannot pass
      as written, and the cause is the same role mismatch D5 fixed for the
      renew case, in a second place.
      The fix means touching an existing rule, which AGENTS.md hard rule 5
      and ERD 3.5 both forbid without a decision. The D5-symmetric option is
      to accept a `ROLE_RENEW` spender in `_checkPaymentTokenApproval` when
      the batch contains a renew. Not written. Options for the owner:
      (a) extend `_checkPaymentTokenApproval` to accept a ROLE_RENEW spender;
      (b) give the renew path its own approve check and leave that function
          untouched;
      (c) something else.
      NOW VERIFIED, 2026-10-22, fourth pass. The oracle half of that worry is
      CLEARED, so option (a) is a one-condition change. On the Sepolia fork,
      chain id 11155111, addresses from `config/networks.ts`:
      - `ETHRenewerV1.rentPriceOracle()` returns
        `0x8196665D4ca7488B6474a9EC8E7d2719FB42263A`.
      - `ETHRegistrar.rentPriceOracle()` returns the SAME address. One oracle
        serves both.
      - That oracle holds code, 16713 hex characters from `cast code`.
      - `oracle.isPaymentToken(MockUSDC)` returns true.
      So `HCARegistrarPolicyLib.isPaymentToken(ETHRenewerV1, MockUSDC)` returns
      true: the renewer answers `rentPriceOracle()`, the oracle has code, and
      the oracle accepts the token. The ONLY condition that refuses an approve
      to the renewer is `_isAuthorizedRegistrar`, the same role mismatch D5
      fixed elsewhere. Option (a) therefore needs one condition changed, not a
      new oracle path.
      STILL NOT WRITTEN, carried from the second pass. Threading the caps into
      `_checkRegistrationExecutions`, which does not receive the proof today,
      and the renew-case checks themselves: exact duration, token equality,
      price at or below `maxRenewSpend` via
      `IETHRenewer.getRenewPrice(rd.label, rd.duration, paymentToken)`, and
      the three batch-shape checks D6 lists. The number for `renewalDuration`
      and its justification in THREAT-MODEL 8 are also still open.
      2026-10-22, fourth pass. The threading and the three stateless checks
      are WRITTEN and the tree is green.
      - New type `RenewPolicy {address paymentToken; uint64 duration; uint96
        maxSpend;}`. NatSpec records that the period cap is the allowance, per
        D6, and is deliberately not a field.
      - `_checkStatelessRegistrationPolicy` builds it from the proof and
        passes it to `_checkRegistrationExecutions`, which now takes an eighth
        parameter. That was the only call site in `src/`.
      - The renew case calls one helper, `_checkRenewCall(execution, owner,
        renewPolicy)`. It enforces three things: `latestOwnerOf(label) ==
        owner`, `rd.duration == renewPolicy.duration` AND `token ==
        renewPolicy.paymentToken`, and
        `getRenewPrice(rd.label, rd.duration, token) <= renewPolicy.maxSpend`.
      - `_renewLatestOwner` and its successor `_renewFields` are gone. The
        owner binding now lives inside `_checkRenewCall`, which decodes once.
      WHY A HELPER, not inline: inline locals in the policy loop hit
      "Stack too deep" on Solc 0.8.27 at the `latestOwner != owner` line. The
      helper holds the locals instead. Do not inline it again. The project
      does not enable `viaIR`, so this is a real constraint, not a style
      choice.
      Two test harness call sites in
      `test/unit/hca/StandaloneSingleOwnerHCA.t.sol` (lines near 2355 and
      2375) call `_checkRegistrationExecutions` directly. Both now pass a zero
      `RenewPolicy`. Those harnesses do not renew, so zero is correct: a zero
      duration and a zero token refuse any renew call.
      Verified: `forge build` -> "Compiler run successful!".
      `forge test --match-path 'test/unit/hca/*'` -> 124 passed, 0 failed,
      9 skipped. Still green, same as before the threading.
      WHAT IS LEFT ON R3, and why it is not done:
      1. The three batch-shape checks from D6: exact-price pull, approve to
         the selected registrar for that same amount, and transferFrom from
         the owner's wallet to the HCA. BLOCKED on the approve decision above,
         option (a), (b) or (c). The approve branch is the same code the
         batch-shape checks must live beside, so writing them before the
         decision would mean writing code the decision can invalidate.
      2. The number for `renewalDuration`, and the THREAT-MODEL section 8
         justification for it and the spend bound. Needs the owner's duration
         choice; D4 recorded that no year constant exists in the contracts, so
         the number is a policy choice and not mine to pick.
      The caps are enforced for a single call. The batch shape is not yet
      checked. Do not read R3 as finished.
      2026-10-22, fifth pass. Probed `getRenewPrice` on the fork, because
      `_checkRenewCall` now calls it and nothing had tested that assumption.
      Three findings. All on the Sepolia fork, ETHRenewerV1, MockUSDC from
      `config/networks.ts`.
      1. `getRenewPrice` REVERTS for a name that is not renewable. For label
         `hello` it reverts `0x1caefaa0`, which is
         `IETHRenewer.NameNotRenewable(string)`. It does not return zero.
         So `_checkRenewCall` can bubble `NameNotRenewable` instead of
         `PolicyRuleFailed`. The owner binding runs BEFORE the price call, so
         T2 and T6 still get `PolicyRuleFailed`: a name held by someone else
         is still renewable, and the binding refuses it first. The exposure is
         a name that has lapsed PAST grace while `latestOwnerOf` still answers
         with the session owner. Then the binding passes and the price call
         bubbles. Whoever writes T2, T6 and T9 must expect `PolicyRuleFailed`
         and should add a case for the lapsed-past-grace path, or the rule
         should call `isRenewable` first. NOT changed; it is a design call and
         the owner has two decisions open already.
      2. A one-second renewal costs 6 units of MockUSDC, and one year on
         `test` costs 160000009. Both read with
         `getRenewPrice(label, duration, token)`. This CONFIRMS D4's reasoning
         from the other direction: a spend cap alone bounds nothing, because a
         dust renewal is almost free and `MIN_RENEW_DURATION` is 1. The
         exact-duration match is the check that does the work.
      3. CONSEQUENCE for the pending cap number, and this is new. The price
         depends on name length. `test` is four characters and costs
         160000009 for one year. `ERD.md` 6.4 grounds the cap on 8.0055 USDC,
         which is a NINE-character name. The two differ by about twenty times.
         So one `maxRenewSpend` cannot serve names of different lengths: a cap
         set from a nine-character name refuses a four-character name, and a
         cap set from a four-character name barely bounds a nine-character
         one. The owner should set the cap per session, from the price of the
         name that session actually renews, not from a single project-wide
         figure. Raise this with the duration number; both are still open.
      2026-10-22, sixth pass. DEFECT FOUND IN MY OWN CODE. Fix this FIRST
      next beat, before anything else on R3. It would make T1 and T5 fail.
      `_checkRenewCall` calls
      `IPermissionedRegistry(ETH_REGISTRY).latestOwnerOf(LibLabel.id(rd.label))`.
      That passes a BARE LABELHASH to an accessor that wants a VERSIONED
      TOKEN ID. Read at clone commit `3e54cdb8`:
      - `PermissionedRegistry.latestOwnerOf(tokenId)` is a one-line
        `return super.ownerOf(tokenId)`, line 374. It does no id
        reconstruction.
      - `getState(anyId)`, line 361, takes a labelhash OR a token id. It
        rebuilds the real id with `_constructTokenId(anyId, entry)` and
        returns `latestOwner` in the struct.
      - `LibLabel.withVersion` replaces the low 32 bits with a version, so a
        bare labelhash and the live token id differ in those bits.
      - EVERY registrar call site uses `getState(LibLabel.id(label))`, never
        `latestOwnerOf(LibLabel.id(label))`: `ETHRegistrar.sol` lines 175, 195
        and 250, `AbstractETHRegistrar.sol` lines 89 and 161.
      Measured on the fork: `latestOwnerOf(keccak256("test"))` returns the
      zero address even though `test` has a future expiry, is renewable, and
      prices normally. So the owner binding compares zero against the owner
      and reverts `PolicyRuleFailed` on every renewal. The rule currently
      refuses everything.
      THE FIX, almost certainly: read the owner through
      `getState(LibLabel.id(rd.label)).latestOwner`. That is what the whole
      codebase does. NOT APPLIED THIS BEAT, because of the open question
      below; a fix I cannot demonstrate is not a fix. This also settles
      `VERIFY.md` item 4, which asks exactly which accessor the validator can
      use: `getState`, not `latestOwnerOf`. Record the evidence there when the
      fix lands.
      ERD 3.3 needs a correction with it. "Use `latestOwnerOf`, not `ownerOf`"
      is right about the SEMANTICS, because the latest owner must survive
      expiry, and wrong about the CALL, because the validator holds a label
      and not a versioned token id. Say "read `latestOwner` from `getState`".
      OPEN QUESTION, and it is why no code changed. `getState` ALSO returned
      a zero `latestOwner`, for `test` and for `alice`. If the right accessor
      returned an owner this would be settled, and it did not. Either these
      Sepolia labels have no owner in `ETHRegistry` (they may be v1
      premigration reservations, which `VERIFY.md` 6 says is today's state),
      or the id needs more than `getState` does. Resolve it by finding a name
      with a NON-ZERO owner before trusting either accessor. Do not write T1
      or T5 against a name whose owner reads zero.
      USEFUL, and keep it: `alice` and `example` are inside their grace period
      on the fork right now, with no clock warping. `getRemainingGracePeriod`
      returns 136692 and 115212 seconds. `test`, `vitalik` and `nick` return
      0. So T5's condition exists naturally on the fork; it does not need
      `vm.warp` if the test runs soon. Those windows close within about two
      days of 2026-10-22, and the fork block is 11971358.
      2026-10-22, seventh pass. DEFECT FIXED and the open question is
      RESOLVED. The rule no longer refuses every renewal.
      How the question was settled: a real registration was pulled from a
      `TransferSingle` log on `ETHRegistry`, token id
      `0xb1b0e712...af4b00000000`, minted by `ETHRegistrar` to
      `0xAD0F6223aFac460386fae5B028E3150D15E04dc8`. The low 32 bits of a live
      token id are the version and read zero. Setting them to `0x12345678`
      stands in for a bare labelhash. Measured on the fork:
      - `latestOwnerOf(real id)` -> `0xAD0F...4dc8`.
      - `latestOwnerOf(low bits 0x12345678)` -> zero.
      - `getState(real id).latestOwner` -> `0xAD0F...4dc8`.
      - `getState(low bits 0x12345678).latestOwner` -> `0xAD0F...4dc8`.
      So `getState` rebuilds the version and finds the owner; `latestOwnerOf`
      cannot. The fix is confirmed, not guessed.
      Why `test` and `alice` read zero earlier: they are RESERVATIONS with an
      expiry and no owner, which matches `VERIFY.md` 6, registration and
      migration not open. It was never an accessor fault for them. Do not use
      those labels as owned names in T1 or T5.
      THE FIX, applied: `_checkRenewCall` now reads
      `getState(LibLabel.id(rd.label)).latestOwner`. Two code comments record
      why, one on the line and one in the NatSpec.
      Verified: `forge build` -> "Compiler run successful!".
      `forge test --match-path 'test/unit/hca/*'` -> 124 passed, 0 failed,
      9 skipped.
      Documents brought in line:
      - `VERIFY.md` item 4: the first half is RESOLVED, with the measurement
        table. The grace and re-registration half still waits on T5 and T6.
      - `ERD.md` 3.3: "Use `latestOwnerOf`, not `ownerOf`" was wrong about the
        call. It now says read `latestOwner` from `getState`, and says why.
      R3 is still not finished. The two owner decisions are unchanged: the
      approve option for the batch-shape checks, and the duration and cap
      numbers, where the per-name-length finding from the fifth pass applies.

      DECIDED 2026-10-22 by the owner. All three open questions answered.
      You are unblocked on R3. Record these as D7 in DECISIONS.md.

      1. DURATION = ONE YEAR, 31557600 seconds, fixed.
         The session data carries it; the call must match it exactly; the
         caller chooses nothing. Reason: it matches how the oracle quotes
         price, it keeps the keeper to one firing per year, and because it is
         an exact match a stolen key can only make full-price one-year calls,
         never the near-free dust renewal you found at MIN_RENEW_DURATION = 1.
         Your finding is what settled this: the exact-duration match is the
         check that does the work, not the cap.

      2. maxRenewSpend IS PER SESSION, NOT A PROJECT CONSTANT. You were right.
         It is set when the session is created, from getRenewPrice for the
         name that session will actually renew, plus headroom for oracle
         drift. Do not bake a single figure into the contract or the config.
         Delete the single 8.0055 USDC figure from ERD.md 6.4 and replace it
         with this model, noting the roughly twentyfold spread you measured
         between a four-character and a nine-character name.

      3. CHECK RENEWABILITY BEFORE THE PRICE CALL, and fail with its own
         clear error. The owner chose clarity over minimality here: a name
         past its grace period must not surface as PolicyRuleFailed from a
         price lookup, because the tests and THREAT-MODEL.md both need to
         state the behaviour accurately.
         Note: the registrar's _isRenewable is internal, so you cannot call
         it. You already reach IPermissionedRegistry.getState(labelId), which
         carries status and expiry. That is likely the cleaner path and adds
         no new dependency, but pick the mechanism yourself and record why.
         Then write T2, T6 and T9 against the error this produces.
      2026-10-22, eighth pass. R3 IS DONE as written, and MARKED. Read the
      two paragraphs at the end before you treat the rule as complete.
      All three answers are implemented or recorded:
      1. Duration one year, 31557600 s. No contract constant was needed: the
         session data already holds `renewalDuration` and the rule already
         exact-matches it, so the number is per session. Recorded in D7.
      2. `maxRenewSpend` per session. Also already a session field, so no code
         change. `ERD.md` 6.4 rewritten: the single 8.0055 USDC figure is GONE,
         replaced by the per-session model and the measured spread, 8.0055 for
         nine characters against 160.000009 for `test` at four.
      3. Renewability check ADDED, before the price call, with its own error
         `RenewalTargetNotRenewable(string label)`, selector `0x0c8b8bba`.
      MECHANISM CHOSEN, and it is NOT the one suggested. The owner proposed
      reading `status` from `getState`; I used
      `IETHRenewer(target).isRenewable(label)` instead. Reason, recorded in
      full in D7: `_constructStatus` returns `AVAILABLE` for ANY expired name,
      so a name inside grace and a name fully lapsed both read `AVAILABLE`. A
      `status == REGISTERED` test would refuse the grace-period renewal, which
      is T5 and the case that matters most. Grace is also not one number, 90
      days and one second on `ETHRenewerV1` against 28 native, and
      `isRenewable` is answered by the target so the validator duplicates
      none of it. The registrar's `_isRenewable` is indeed internal, but the
      interface's `isRenewable(string)` is external and I confirmed it on the
      fork.
      Order in `_checkRenewCall`: owner binding, duration and token,
      renewability, price. A lapsed name whose `latestOwner` still reads as
      the session owner passes the binding and is then caught by the
      renewability check with the clear error. That was the exposure.
      Verified: `forge build` -> "Compiler run successful!".
      `forge test --match-path 'test/unit/hca/*'` -> 124 passed, 0 failed,
      9 skipped.
      WHAT IS NOT IN R3, and is still blocked. The three batch-shape checks
      from D6 are NOT written: the exact-price pull, the approve to the
      selected registrar for that same amount, and the `transferFrom` from the
      owner's wallet to the HCA. They are not in R3's text; they arrived with
      D6, after R3 was written. They are blocked on the approve question from
      the third pass, which is still unanswered: `_checkPaymentTokenApproval`
      accepts a spender only via `_isAuthorizedRegistrar`, and `ETHRenewerV1`
      does not hold `ROLE_REGISTRAR`, so an approve to the renewer reverts.
      Options (a), (b), (c) are listed under the third pass. The oracle half
      of that worry is already cleared, so it is one condition.
      This surfaces at T1, the PASS case, which cannot pass without it. It is
      recorded under T1 too, so it cannot be lost by marking R3 done.

- [x] R4. forge build clean.
      2026-10-22: The build is clean and the suite is green. Two caveats
      below; read them before citing this item as evidence of a tidy change.
      - `forge build` -> "No files changed, compilation skipped", on a tree
        that last compiled with "Compiler run successful!".
      - `forge test --match-path 'test/unit/hca/*'` -> 124 passed, 0 failed,
        9 skipped. The 9 skips are the AutoRenewPolicy skeleton, which is
        correct until T1 to T9 are written.
      CAVEAT 1. `forge fmt --check` FAILS, on 137 files. It fails at baseline,
      on files this project never touched, including `ETHRegistrar.sol` and
      `ETHRenewerV1.sol`. `contracts/foundry.toml` has NO `[fmt]` section, so
      the clone is simply not formatted to forge fmt defaults. Do not treat
      `forge fmt --check` as a gate on this clone, and do not "fix" it: that
      would reformat the whole upstream repository.
      CAVEAT 2, and it is MY defect to clean up. FIX IT NEXT BEAT.
      I ran `forge fmt` on the files I edited. Because the repo is not in
      forge fmt style, that reformatted them wholesale. `git diff --stat`:
        HCAOwnerAndSessionValidator.sol      457 lines changed
        HCAOwnerAndSessionValidator.t.sol    720 lines changed
        HCARegistrarPolicyLib.sol             32 lines changed
        StandaloneSingleOwnerHCA.t.sol         6 lines changed
      The real logic is about 60 lines in the validator and about 10 in the
      test. The rest is whitespace and rewrapping. That buries the change,
      and ERD 3.5 and the AGENTS hard rules both say to add a case and leave
      the rest alone. A reviewer cannot read this diff.
      REMEDIATION, next beat, with a full budget:
      1. `git checkout HEAD -- contracts/src/hca/HCAOwnerAndSessionValidator.sol`
         and the same for the other three tracked files. Save copies first.
      2. Re-apply ONLY the logic, in the file's EXISTING style, by hand. The
         complete list is in R2's and R3's notes: three imports, the
         `RenewPolicy` struct, the `RenewalTargetNotRenewable` error, the
         header length 110 -> 150, three `SessionEnableProof` fields, three
         decode slices, three salt fields, the renew case, the
         `_isAuthorizedRenewer` helper, the `_checkRenewCall` helper, the
         `RenewPolicy` argument at the one call site, and the eighth
         parameter. In the test: three fixture fields, three `_packProof`
         fields, three salt fields. In `StandaloneSingleOwnerHCA.t.sol`: the
         zero `RenewPolicy` at two harness call sites.
      3. Do NOT run `forge fmt` on a whole file again. Match the surrounding
         style by hand and verify with `git diff --stat`: the validator should
         be well under 100 changed lines.
      4. Re-run `forge build` and the hca suite. Both must return to the
         numbers above.
      2026-10-22, later: REMEDIATION DONE. The diff is clean and the tree is
      green. Nothing is outstanding on this.
      Method: backed the four files up to `/tmp/auto-renew-backup-1609/`,
      `git checkout HEAD --` on all four, then re-applied every logic edit by
      hand in the file's OWN style. `forge fmt` was NOT run on any file.
      Result, `git diff --stat`, against 457 / 720 / 32 / 6 before:
        HCAOwnerAndSessionValidator.sol      106 lines changed
        HCARegistrarPolicyLib.sol             15 lines changed
        HCAOwnerAndSessionValidator.t.sol     11 lines changed
        StandaloneSingleOwnerHCA.t.sol         6 lines changed
      Total 130 insertions, 8 deletions, down from 468 insertions and 747
      deletions. Nearly pure addition now, which is what "add a case, do not
      alter the others" should look like.
      Verified unchanged in behaviour: `forge build` -> "Compiler run
      successful!", 6 files. `forge test --match-path 'test/unit/hca/*'` ->
      124 passed, 0 failed, 9 skipped. Identical to the numbers before the
      restore, so the re-application lost nothing.
      LESSON, for anyone editing this clone: the repo is NOT in forge fmt
      style and has no `[fmt]` section. Never run `forge fmt` on a file here.
      Match the surrounding style by hand and check `git diff --stat`.
      NOT STARTED this beat, because the restore took the budget: the owner's
      option (b) approve check and the three D6 batch-shape checks, which are
      the real blocker for T1. The decision is recorded above T2. Next beat
      starts there, and it now starts on a clean diff.

## The matrix, one test per beat
- [x] T1. Session key renews a name the owner holds. PASS.
      2026-10-22, BLOCKED before it is started. T1 needs the full batch, and
      the batch cannot validate yet.
      The money moves as D6 describes: `transferFrom` from the owner's wallet
      to the HCA, `approve` to the registrar, then `renew`. The approve step
      hits `_checkPaymentTokenApproval`, which accepts a spender only through
      `_isAuthorizedRegistrar`. Per D5, `ETHRenewerV1` does not hold
      `ROLE_REGISTRAR`, so the approve reverts `PolicyRuleFailed` and the
      batch fails for a reason that has nothing to do with the renewal rule.
      Waiting on the approve decision, options (a), (b) or (c) under R3's
      third pass. The three batch-shape checks land with it.
      The refusal tests do NOT need this. T2, T3, T7 and T8 refuse before any
      money moves, so they can be written first if a beat wants useful work
      while this waits. T5 also needs the batch.
      Also for T1: do NOT use `test`, `alice`, `vitalik` or `nick` as the
      owned name. They are reservations with a zero owner. Use a name with a
      real owner, for example the token id from the `TransferSingle` log
      recorded in R3's seventh pass.
      DECIDED 2026-10-22 by the owner: OPTION (b). You are unblocked on T1
      and on the three D6 batch-shape checks. Record as D8 in DECISIONS.md.

      Give the renew path its own approve check. Leave
      `_checkPaymentTokenApproval` untouched; `register` and `commit` keep
      using it unchanged.

      Reason: this is the same precedent as D5. There we gave renew its own
      authority check rather than changing `_isAuthorizedRegistrar`. The same
      applies here. Option (a) is the smaller diff but it modifies a rule that
      register and commit also depend on, which forces a reviewer to
      re-verify both of those paths. "We added one rule and altered none" is
      the proposal, and that is worth more than a shorter diff.

      The renew-path approve check must require: the spender holds ROLE_RENEW
      on the registry root, the spender is the same registrar the renew call
      in that batch targets, and the amount equals the exact quoted price from
      D6. Not a maximum. Exact.

      Then write the three D6 batch-shape checks and T1.
      2026-10-22, next pass. D8 RECORDED in `DECISIONS.md`. No code written
      this beat; the design turned out to need one more finding first, and the
      finding changes the scope. Read D8 before you write anything.
      THE FINDING. `_checkFundingCall` already enforces exactly the pull shape
      D6 wants: `_requireArgAddress(callData, 4, state.owner)` and
      `(callData, 4 + 32, state.account)`, with the amount matched. So source
      the owner's wallet and destination the HCA are already written.
      BUT it only reaches that code after a `permit`. It reverts when
      `!state.permitted`, and it requires `index == state.permitIndex + 1`.
      D6 has NO permit: the owner granted a standing allowance, so the batch
      starts at `transferFrom`. A D6 batch therefore fails that branch. It can
      also miss the branch entirely, because the branch needs
      `fundingToken != address(0)` and `fundingToken` is `proof.refundToken`,
      which a renew session need not set; then the `transferFrom` falls to the
      end of the chain and gets `ActionNotAllowed`.
      So the renew path needs its own `transferFrom` check too, not only its
      own approve check. Same reasoning the owner gave for the approve, and it
      alters no existing rule. Recorded as D8 consequence 2 and FLAGGED there,
      not assumed.
      THE IMPLEMENTATION, for the next beat. One piece of work, not three.
      1. Add a batch-state struct carried through the loop, beside
         `RegistrationPolicyState` and `FundingPolicyState`:
         the renew target, the exact price, and whether a renew, an approve
         and a pull were seen, with the approve spender and both amounts.
      2. Add two branches to the if-chain, BEFORE the generic
         `IERC20.approve` branch so the generic one is never reached for a
         renew batch, and leave `_checkPaymentTokenApproval` alone.
      3. `_checkRenewCall` already computes the price. Store it in the batch
         state instead of discarding it, so the post-loop comparison has it.
      4. After the loop, beside the existing
         `funding.permitted != funding.transferred` test: if a renew was seen,
         require an approve and a pull, require both amounts to EQUAL the
         price, and require the approve spender to be the renew target.
      5. Then T1.
      Order matters for the exactness test: the price is only known once the
      renew execution is read, so all three comparisons must happen after the
      loop, never inside it.
      2026-10-22, next pass. THE BATCH-SHAPE CHECKS ARE WRITTEN. The build
      and the suite are green. The T1 TEST ITSELF IS STILL NOT WRITTEN; that
      is the next step, and T1 stays unchecked.
      What went in, all four requirements:
      - A renew money branch, FIRST in the if-chain, gated on
        `renewPolicy.paymentToken != address(0) && execution.target ==
        renewPolicy.paymentToken` and the `approve` or `transferFrom`
        selector. A registration session has a zero renew payment token, so
        register and commit never reach it and keep their own rules. This is
        how option (b) was honoured: `_checkPaymentTokenApproval` is
        UNTOUCHED.
      - `_checkRenewMoneyCall` records the approve spender and amount, or
        checks the pull shape and records its amount. The pull requires source
        `funding.owner` and destination `funding.account`, the same shape
        `_checkFundingCall` enforces, but with NO permit, per D6. Each leg may
        appear once.
      - `_checkRenewCall` now records the target and the exact price, and
        refuses a second renew in one batch.
      - `_checkRenewBatch`, called after the loop beside the existing
        `funding.permitted != funding.transferred` test. If a renewal was
        seen it requires an approve AND a pull, the approve spender to equal
        the renew target, and BOTH amounts to equal the price exactly. If no
        renewal was seen it refuses a stray approve or pull on the renew
        token.
      D8 point 1 is satisfied transitively, and the code says so: the renew
      target already passed `_isAuthorizedRenewer`, so requiring the approve
      spender to equal the target also proves the spender holds `ROLE_RENEW`.
      DESIGN NOTE, worth a look. Two "Stack too deep" failures forced the
      shape. Solc 0.8.27 with no `viaIR` has no room in
      `_checkRegistrationExecutions` for another struct. So the batch fields
      live INSIDE `RegistrationPolicyState` as eight new members rather than
      in their own struct, and `_checkRenewMoneyCall` takes
      `FundingPolicyState` for the HCA and owner rather than two addresses.
      The tradeoff: this extends a struct that register and commit also use.
      The additions are additive and no existing branch reads them, but it is
      not the clean separation D8's reasoning implies, and it forced one
      harness literal in `StandaloneSingleOwnerHCA.t.sol` to grow from three
      named fields to eleven. Say so if you want a separate struct instead;
      that needs a slot freed elsewhere, or `viaIR`, which is a project-wide
      change and not mine to make.
      Verified: `forge build` -> "Compiler run successful!".
      `forge test --match-path 'test/unit/hca/*'` -> 124 passed, 0 failed,
      9 skipped. Unchanged from before this work, so nothing regressed.
      NEXT: write the T1 test. The rule is now complete enough to pass it.
      Use a name with a real owner, not `test`, `alice`, `vitalik` or `nick`.
      The batch is pull, approve, renew, with both amounts equal to
      `getRenewPrice(label, 31557600, token)` exactly.
      2026-10-22, next pass. NO TEST WRITTEN. One prerequisite has to be
      settled first, and it belongs to T1 to T9 as a group, not to T1 alone.
      Say if you want it decided differently; otherwise the next beat builds
      option (a) below.
      THE PREREQUISITE. `ERD.md` section 4 says run tests 1 to 9 on a fork of
      Sepolia against the deployed contracts, and `AGENTS.md` says verify
      against deployed contracts, never a local ABI. So T1 is a FORK test.
      But a Forge test cannot read `config/networks.ts`, and the heartbeat
      rule says addresses come from that file and must never be hardcoded.
      There is no mechanism yet. `.env` carries RPC URLs and keys only:
      DEPLOYER_PRIVATE_KEY, SESSION_PRIVATE_KEY, FALLBACK_ADDRESS,
      WATCHED_LABELS, the four RPC URLs and ETHERSCAN_API_KEY. No addresses.
      Three ways, none built:
      (a) the test reads `vm.envAddress("ETH_REGISTRY")` and friends, and a
          small exporter writes them into `.env` from `networks.ts`.
          `networks.ts` stays canonical and nothing is duplicated by hand.
          Needs new keys in `.env` and `.env.example`.
      (b) `vm.readFile` on `networks.ts` and parse it in Solidity. Fragile.
      (c) generate a Solidity constants file from `networks.ts`. Keeps one
          source, adds a build step and a generated file to the tree.
      Option (a) is the smallest and the most conventional. It also matches
      how `preflight` already treats `networks.ts` as the source.
      WHAT THE EXISTING SUITE DOES, and why T1 cannot copy it.
      `HCAOwnerAndSessionValidator.t.sol` `setUp` is NOT forked. It deploys a
      real `PermissionedRegistry` locally, grants `ROLE_REGISTRAR` to a
      `makeAddr("eth-registrar")` placeholder, and points the harness at
      those. That is fine for the register path, which needs no price oracle.
      A renew test needs a target that answers `isRenewable` and
      `getRenewPrice`, so it needs either the real `ETHRenewerV1` on a fork or
      a new mock. The fork is what ERD 4 asks for.
      THE SHAPE OF T1, once addresses resolve:
      1. Fork Sepolia. Deploy `MockStandaloneHCA` and the validator harness on
         the fork, pointed at the REAL `ETHRegistry`.
      2. Get an owned name. Do not use `test`, `alice`, `vitalik` or `nick`;
         they are reservations with a zero owner. Take the real registration
         from the `TransferSingle` log in R3's seventh pass, token id
         `0xb1b0e712...af4b00000000`, owner
         `0xAD0F6223aFac460386fae5B028E3150D15E04dc8`, and `vm.prank` that
         owner to transfer the name to the test owner. The LABEL for that
         token id is not yet known and the rule needs the label, not the id,
         so find it first: either from the registration transaction's calldata
         or by registering a fresh name on the fork as the test owner. The
         second is simpler and gives a known label.
      3. Build the session proof with the 150-byte header. The three new
         fields are `renewPaymentToken`, `renewalDuration` = 31557600, and
         `maxRenewSpend` from `getRenewPrice` plus headroom. Mirror them into
         the salt, or the permissionId diverges; that was the bug in R3's
         third pass.
      4. The batch is three executions: `transferFrom(owner, hca, price)`,
         `approve(renewer, price)`, `renew(...)`. Both amounts EXACTLY the
         price from `getRenewPrice(label, 31557600, token)`.
      5. Assert it validates, then remove the `vm.skip` line.
      Budget note, offered as a fact and not an excuse: T1 has not fitted an
      eight-minute beat three times now. Steps 1 to 3 are shared by every
      later test, so they are worth one beat on their own, with the first
      assertion in the beat after.
      2026-10-22, next pass. THE PREREQUISITE IS BUILT AND VERIFIED. Option
      (a), as that note said it would be absent other instruction. The fork
      fixture for T1 to T9 now exists. The nine cases still skip; no
      assertion is written yet.
      WHAT WENT IN:
      - `config/export-env.ts`. It IMPORTS `config/networks.ts` with bun,
        which runs TypeScript natively, and prints environment lines. It does
        not parse the file, so the two cannot drift. It writes NO file:
        `addresses.json` was removed on purpose and a second address file
        would undo that. Keys are prefixed `AR_` so they cannot collide with
        an operator secret, and the header records the branch, commit and
        deployment date from `networks.ts`.
      - A `setUp` in `test/unit/hca/AutoRenewPolicy.t.sol`. It forks Sepolia
        from `SEPOLIA_RPC_URL`, then reads `AR_ETHREGISTRY`,
        `AR_ETHRENEWER_V1`, `AR_ETHREGISTRAR` and `AR_TOKEN_USDC` with
        `vm.envAddress`. No address literal appears anywhere in the test.
      - Five guards in `setUp`: the chain id equals `AR_CHAIN_ID`, and all
        four contracts have code. They fail in `setUp`, not inside a case, so
        a misconfigured run cannot look like a passing test.
      THE RUN COMMAND, which the test file also carries as a comment:
        cd /Users/oakgroup/auto-renew
        set -a; . <(bun config/export-env.ts 11155111); . ./.env; set +a
        cd contracts-v2/contracts && forge test --match-path \
          'test/unit/hca/AutoRenewPolicy.t.sol'
      Shell exports, deliberately. Nothing is written into the clone, so there
      is no new file to gitignore and no risk of a stale copy.
      VERIFIED BOTH WAYS, which matters for a fixture whose job is to fail:
      - Good run: 0 passed, 0 failed, 9 skipped, in 1.27s. The 1.27s against
        0.4ms before is the fork actually being created, so `setUp` ran and
        every guard held.
      - Negative run, with `AR_ETHREGISTRY` forced to `0x…dEaD`:
        "[FAIL: ETHRegistry has no code: 0 <= 0] setUp()", suite FAILED. The
        guards are live, not decoration.
      STILL TO DO ON T1, from the five-step shape above: steps 2 to 5. Get an
      owned name with a KNOWN LABEL, which is still the open practical
      question; registering a fresh name on the fork as the test owner is the
      simpler route and gives the label directly. Then the session proof with
      the 150-byte header and the three fields mirrored into the salt, then
      the three-execution batch, then the assertion.
      Small follow-up, not done: add the run command to `config/README.md`, so
      it does not live only in a test comment and this ledger.
      2026-10-22, next pass. STEP 2 IS DONE AND VERIFIED, and the fixture
      found something that changes T1 and T9. The nine cases still skip.
      STEP 2, how the owned name is made. `setUp` now calls
      `_registerOwnedName`, which pranks `ETHRegistrar` and calls
      `IPermissionedRegistry.register(LABEL, hcaOwner, IRegistry(0),
      address(0), 0, block.timestamp + 365 days)`. `ETHRegistrar` holds the
      root `ROLE_REGISTRAR`, verified on chain in R2, so the prank reaches
      `register` with no commit, reveal or payment. The label is therefore
      KNOWN, which the rule needs: it computes `LibLabel.id(label)` from the
      call data. `LABEL` is `auto-renew-policy-t1`.
      THE FINDING. A freshly v2-registered name is NOT renewable through
      `ETHRenewerV1`. The first run failed on "fresh name is not renewable"
      with `ETHRenewerV1` as the target. `ETHRenewerV1` serves PREMIGRATED v1
      names, so it refuses a native v2 registration. `ERD.md` 3.3 and 6.1 both
      say the v2 path is `ETHRegistrar`; the fixture turned that from prose
      into a measurement.
      Now asserted in `setUp`, both directions:
      - `ETHRegistrar.isRenewable(LABEL)` is TRUE.
      - `ETHRenewerV1.isRenewable(LABEL)` is FALSE.
      CONSEQUENCES:
      - T1's renew TARGET is `ETHRegistrar`, not `ETHRenewerV1`. The price
        comes from `ETHRegistrar.getRenewPrice` and the approve spender must
        be `ETHRegistrar`, because `_checkRenewBatch` requires the approve
        spender to equal the renew target. `ETHRegistrar` holds both
        `ROLE_REGISTRAR` and `ROLE_RENEW`, so `_isAuthorizedRenewer` admits
        it. The rule needs no change.
      - T9 gains a concrete shape, and it is the INVERSE of the item's
        wording. The item says "a v1 name through the wrong registrar". What
        the fork supports today is the mirror: a v2 name sent to
        `ETHRenewerV1`. The rule's authority check PASSES there, because
        `ETHRenewerV1` holds `ROLE_RENEW`, and the refusal comes from the new
        `RenewalTargetNotRenewable` error, because `isRenewable` is false.
        That is exactly why D7 put the renewability check before the price
        call. Write T9 against `RenewalTargetNotRenewable`, and note in the
        test why the direction is reversed.
      - `ETHRenewerV1` stays in the fixture for that case. It is not dead
        weight.
      Verified: the full run is 0 passed, 0 failed, 9 skipped, with every
      `setUp` guard holding. The registration and both renewability
      assertions run before any case.
      NEXT, steps 3 to 5 of the shape above: the session proof with the
      150-byte header and the three fields mirrored into the salt, the
      three-execution batch with both amounts equal to
      `ETHRegistrar.getRenewPrice(LABEL, 31557600, token)`, then the
      assertion and removing the `vm.skip`. The proof packing and salt
      machinery already exist in `HCAOwnerAndSessionValidator.t.sol` but are
      private to that contract, so they must be duplicated here or lifted
      into a shared helper; decide which when writing it.
      2026-10-22, next pass. STEP 3's FOUNDATION IS IN. The stack is on the
      fork and the price is read from the oracle. The nine cases still skip;
      the proof and the batch are the remaining work.
      DECIDED, the duplication question above: DUPLICATE the proof packing and
      salt into `AutoRenewPolicy.t.sol` when the proof is built. Do not lift
      them out of `HCAOwnerAndSessionValidator.t.sol`. Lifting would alter a
      file this change should leave alone, and the diff story is "we added one
      rule and altered none". Duplication inside a NEW test file costs
      nothing by comparison. The reason is written in the test as a comment.
      WHAT WENT IN:
      - `hcaOwner` is now `makeAddrAndKey("hca-owner")`, so the owner has a
        KEY. It has to sign the session authorization.
      - `_deployHCAStack` deploys `MockStandaloneHCA(hcaOwner)` and
        `HCAOwnerAndSessionValidatorEnableHarness` ONTO THE FORK, pointed at
        the REAL `ETHRegistry` from `AR_ETHREGISTRY`. The adapters and the
        resolver implementation are placeholders; a renewal touches none of
        them. `ERD.md` 6.2 asks for exactly this shape.
      - A guard that the deployed validator's `ETH_REGISTRY()` equals the real
        registry. Without it the later cases could pass against nothing.
      - `RENEWAL_DURATION = 31557600`, one year, per D7, with a comment that
        the contracts define no year and `MIN_RENEW_DURATION` is 1.
      - `_readRenewPrice` quotes
        `ETHRegistrar.getRenewPrice(LABEL, 31557600, MockUSDC)` from the live
        oracle and stores it. The batch must pull and approve this exact
        number, so the test must not invent it.
      THE NUMBER, measured on the fork: 8005501, in MockUSDC's smallest unit,
      so 8.005501 USDC for one year on `auto-renew-policy-t1`, which is 20
      characters. That agrees with the 8.0055 USDC in `ERD.md` 6.4 for a
      nine-character name, so the oracle's price is flat above some length.
      Useful for the cap: a cap set from a long name suits any longer name,
      and the twentyfold jump measured earlier is at the SHORT end.
      Verified: 0 passed, 0 failed, 9 skipped, 966ms. Every `setUp` guard
      holds: fork and chain id, four contracts have code, the fresh name is
      owned by `hcaOwner` and renewable on `ETHRegistrar` but not on
      `ETHRenewerV1`, the validator points at the real registry, and the
      oracle quotes a non-zero price.
      REMAINING on T1, and it is now only the proof and the batch:
      1. Pack the 150-byte proof header with `renewPaymentToken` = MockUSDC,
         `renewalDuration` = 31557600 and `maxRenewSpend` = `renewPrice` plus
         headroom. Mirror all three into the salt or the permissionId diverges;
         that was the bug in R3's third pass.
      2. Build the three executions: `transferFrom(hcaOwner, hca, renewPrice)`,
         `approve(ethRegistrar, renewPrice)`, `renew(...)` with the target
         `ethRegistrar`. Both amounts EXACTLY `renewPrice`.
      3. Drive it through the validator's ERC-1271 path as `intentExecutor`,
         assert it validates, and remove the `vm.skip`.
      2026-10-22, next pass. NO CODE. The beat went on reading the ERC-1271
      path and inventorying what the proof needs. The next beat is mechanical;
      this note is the whole shopping list so nobody rediscovers it.
      THE CALL SHAPE, copied from
      `test_validator_acceptsFirstSameChainRouteWithMultiChainSessionAuthorization`
      at line 336. Four steps:
        (proof, permissionId) = _multiChainEnableProof();
        gasRefund = GasRefund({token: proof.refundToken, exchangeRate:
            proof.maxRefundExchangeRate, overhead: (maxRefundAmount << 128) |
            maxRefundGasOverhead});
        digest = validator.singleChainDigestWithRefundHarness(address(hca),
            nonce, operationData, gasRefund);
        assertEq(hca.validate(validator, digest, envelope), ERC1271_MAGICVALUE);
      So the assertion for T1 is `hca.validate(...) == ERC1271_MAGICVALUE`.
      WHAT MUST BE DUPLICATED, all private to
      `HCAOwnerAndSessionValidatorTest`, with line numbers at commit
      `3e54cdb8` plus my edits:
      - constants, lines 85 to 101: SMART_SESSION_DOMAIN_TYPEHASH,
        SMART_SESSION_NAME_HASH, SMART_SESSION_VERSION_HASH,
        CHAIN_SESSION_TYPEHASH, MULTI_CHAIN_SESSION_TYPEHASH,
        OWNABLE_SESSION_VALIDATOR `0x000000000013fdB5234E4E3162a810F54d9f7E98`.
      - `SessionEnableProofFixture` struct, line 43, which already carries my
        three fields.
      - `_multiChainEnableProof`, 768 to 848. Builds the fixture, the salt and
        the permissionId. THIS is where the three fields must be mirrored into
        the salt; the salt is near line 633 in the current file.
      - `_packProof`, 849 to 875. Already carries my three fields.
      - `_signRhinestoneMessage`, 1063 to 1073.
      - `_encodeExecutions`, 711 to 732, and `_operationHash`, 970 to 986.
      - `_envelope`, 1031 to 1051, `_initialRefundEnvelope`, 659 to 686, and
        `_slice`, 1052 to 1062.
      REVISED DECISION on duplication. The inventory is about 250 lines, not
      the 80 I assumed, so "duplicate it inline" was priced wrong. Put it in a
      NEW file instead, `test/unit/hca/AutoRenewSessionFixture.sol`, as a base
      contract that only `AutoRenewPolicy.t.sol` inherits. That keeps the
      existing test file UNTOUCHED, which is still the point, and keeps the
      test readable rather than burying nine cases under 250 lines of
      scaffolding. The logic does exist twice in the repo; that is the price
      of not editing a file this change should leave alone. Lifting the
      helpers out of the existing test into a shared base is the cleaner
      engineering and the worse diff. Say so if you would rather pay the diff.
      THEN: the three executions, with the renew target `ethRegistrar`, both
      amounts exactly `renewPrice` which measured 8005501, and the operation
      built by `_encodeExecutions` rather than the commit builder the existing
      tests use.
      2026-10-22, next pass. THE FIXTURE FILE EXISTS AND COMPILES.
      `test/unit/hca/AutoRenewSessionFixture.sol`, 198 lines, an
      `abstract contract AutoRenewSessionFixture is Test`.
      HOW IT WAS MADE, and this matters for trusting it: the helpers were
      EXTRACTED from `HCAOwnerAndSessionValidator.t.sol` by a script that
      copies line ranges verbatim. Nothing was retyped, so there is no
      transcription risk. The file header records that it is a copy taken at
      commit `3e54cdb8`, why it is a copy and not a lift, and that it must
      follow if the proof format moves.
      WHAT IT CARRIES: `OPS_TYPEHASH` and `OP_TYPEHASH`, the five
      SMART_SESSION and CHAIN_SESSION typehashes, `OWNABLE_SESSION_VALIDATOR`,
      `SOURCE_CHAIN_ID`, `SESSION_KEY`, `OWNER_KEY`, the
      `SessionEnableProofFixture` struct with my three fields, and
      `_encodeExecutions`, `_decodeOperation`, `_operationHash`, `_slice`,
      `_signRhinestoneMessage` and `_packProof`.
      DELIBERATELY NOT COPIED: `_multiChainEnableProof`. It reads the test
      contract's own state and builds a proof for the REGISTER path, so it
      must be written fresh against the fork fixture, with the renew fields
      set and all three mirrored into the salt. That is the next piece of
      work, and it is the one place a copy would have been wrong.
      Verified: `forge build` -> "Compiler run successful!".
      `forge test --match-path 'test/unit/hca/*'` -> 124 passed, 0 failed,
      9 skipped. The new file changes nothing for the existing suites.
      The working tree is still clean in shape: four modified files and two
      new ones, `AutoRenewPolicy.t.sol` and `AutoRenewSessionFixture.sol`,
      both untracked and both new to this project.
      NEXT, and T1 is close now:
      1. Make `AutoRenewPolicyTest` inherit `AutoRenewSessionFixture`, and
         drop the duplicate `Test` inheritance and any symbol the fixture now
         provides.
      2. Write `_renewEnableProof()`: the fixture struct with
         `renewPaymentToken` = MockUSDC, `renewalDuration` = 31557600,
         `maxRenewSpend` = `renewPrice` plus headroom, the owner signature
         over the multi-chain digest, and the three fields mirrored into the
         salt before `permissionId` is derived.
      3. Build the three executions and the envelope, then assert
         `hca.validate(validator, digest, envelope) == ERC1271_MAGICVALUE`
         and remove the `vm.skip` from `test_renew_ownedName_succeeds`.
      2026-10-22, next pass. STEPS 1 AND 2 ARE DONE. Only the assertion is
      left. The cases still skip.
      - `AutoRenewPolicyTest` now inherits `AutoRenewSessionFixture` instead of
        `Test`, so all the copied machinery is in scope.
      - `sessionSigner` is `vm.addr(SESSION_KEY)`, because `_envelope` signs
        the session with that key. `hcaOwner` is `makeAddrAndKey("hca-owner")`
        and `_renewEnableProof` signs the owner authorization with that key,
        NOT with `OWNER_KEY`. See the correction below for why.
      - `_renewEnableProof()` written, adapted from `_multiChainEnableProof`.
        Differences from the register version, all deliberate: the three renew
        fields are set, `renewPaymentToken` = MockUSDC, `renewalDuration` =
        31557600, `maxRenewSpend` = the live quote plus a tenth for oracle
        drift per D7; the refund fields are zero; and `resolver` stays zero
        because a renewal touches no resolver. All three renew fields go into
        the SALT, with a comment saying why: omitting them makes the test's
        permissionId diverge from the validator's and the proof is refused
        with `InvalidSessionData`. That was the bug in R3's third pass and it
        cost a beat.
      - `_renewExecutions()` written: the three D6 legs in order,
        `transferFrom(hcaOwner, hca, renewPrice)`,
        `approve(ethRegistrar, renewPrice)`, and `renew(RenewData{LABEL,
        31557600, 0}, MockUSDC)` against `ethRegistrar`. Both amounts are the
        exact quote, which is what `_checkRenewBatch` compares.
      One compile error on the way, fixed: `HCASmartSessionLib` was not
      imported in the test.
      A FORK HAZARD, found by a failing run and worth remembering. The first
      version used `hcaOwner = vm.addr(OWNER_KEY)`, matching the copied
      machinery. `setUp` then failed with
      `ERC1155InvalidReceiver(0xe05fcC23807536bEe418f142D19fa0d21BB0cfF7)`:
      registering the name mints an ERC-1155 to the owner, and that address
      already holds code on Sepolia. `cast code` returns
      `0xef0100db53cfe1f5d6bf0d9ffcbda8f240b1fdfee1dba0`, an EIP-7702
      delegation designator, so it is a delegated account and not a plain EOA.
      A test key that is free on a blank chain need not be free on a real one.
      Any later fork test that MINTS to an address must use a fresh
      `makeAddrAndKey`, never a hardcoded test key. A signer may keep a fixed
      key, because a signer never receives a token. The reason is in the test
      as a comment.
      Verified AFTER that fix: `forge build` -> "Compiler run successful!",
      and the fork suite reports 0 passed, 0 failed, 9 skipped in 876ms.
      CORRECTION: an earlier line in this note claimed that result before the
      run had finished. The run failed, for the reason above. The numbers
      quoted here are the ones measured after the fix.
      LAST STEP, and T1 is done: build the envelope and assert. The shape is
      in the note above, from line 336 of the existing test. Take
      `operationData` from `_encodeExecutions(_renewExecutions())`, get the
      digest from `validator.singleChainDigestWithRefundHarness(address(hca),
      nonce, operationData, gasRefund)` with a ZERO `GasRefund` since the
      refund fields are zero, build the envelope with `_envelope(permissionId,
      claimData, operationData, digest)`, then assert
      `hca.validate(validator, digest, envelope) == ERC1271_MAGICVALUE` and
      delete the `vm.skip` line. The one unknown is what `claimData` must be
      for the same-chain route; `_initialRefundEnvelope` at line 659 of the
      existing test is the model and was NOT copied, so read it first.
      2026-10-22: T1 PASSES AND IS MARKED. This is the first evidence for the
      contested claim: a session key renewed a name its owner holds, on a fork
      of Sepolia, against the deployed `ETHRegistrar`, through the modified
      validator, with the full D6 batch.
        [PASS] test_renew_ownedName_succeeds() (gas: 142624)
        5 suites: 125 passed, 0 failed, 8 skipped
      The 8 skips are T2 to T9. Nothing regressed; the other suites are the
      same 124 as before plus this one.
      TWO CORRECTIONS to the plan above, both found by running it:
      1. The envelope is MODE 5, `_initialRefundEnvelope` at line 659, not the
         mode 4 `_envelope` the note suggested. Mode 5 is the same-chain route
         and carries no `claimData`: it packs the proof, the nonce, the three
         gas-refund fields, the operation and the session signature. Copied as
         `_renewEnvelope`, with a comment that it was not in the extracted
         fixture. So the `claimData` question was the wrong question.
      2. The refund fields CANNOT all be zero. The validator refuses a zero
         refund configuration on this route. They now carry the same non-zero
         values the register fixture uses: `refundToken` = MockUSDC,
         exchange rate 5000000000, overhead 100000, amount 25000000. The note
         above said to use a zero `GasRefund`; that was wrong.
      Worth keeping: `refundToken` is the payment token, so `fundingToken` is
      non-zero and the funding branch is live. The renew money branch still
      wins, because it sits FIRST in the if-chain and gates on the session's
      renew payment token. That ordering choice from D8 is now exercised, not
      just argued.
      HONEST LIMIT ON THIS PASS. T1 proves the batch is ACCEPTED. It does not
      prove the policy has teeth: a rule that accepted everything would also
      pass it. The refusals are T2, T3, T4, T6, T7, T8 and T9, and T2 is next.
      Until at least one refusal passes, read T1 as "the happy path works",
      not as "the rule is correct".

- [x] T2. Session key renews a name the owner does NOT hold. REVERT.
      2026-10-22: PASSES. This is the request, and it now has evidence.
        [PASS] test_renew_foreignName_reverts() (gas: 136766)
        [PASS] test_renew_ownedName_succeeds() (gas: 158005)
        Suite: 2 passed, 0 failed, 7 skipped.
      T1 and T2 together are the first pair with teeth: the same batch, the
      same session, the same price, the same renewability, differing only in
      who owns the name. One is accepted and one is refused with
      `PolicyRuleFailed`. So T1 is no longer a bare happy path.
      HOW IT IS ISOLATED. `FOREIGN_LABEL` is `auto-renew-policy-t2`,
      registered in `setUp` to a `foreignOwner`, and the SAME LENGTH as
      `LABEL` so the oracle prices both identically. The money legs are built
      from the quote for whichever label is renewed, so they are always
      correct and a failure cannot be blamed on them. The only variable is
      ownership.
      REFACTOR that made it possible: `_renewExecutionsFor(label, duration)`
      replaces the fixed `_renewExecutions`, and `_prepareBatch` returns the
      digest and envelope. T3 to T9 should each vary ONE argument.
      A TRAP, and it will bite every remaining refusal case. The first T2 run
      reported "next call did not revert as expected", which reads like a hole
      in the rule. It was not. `vm.expectRevert` binds to the next EXTERNAL
      call, and preparing a batch makes external calls of its own, to
      `getRenewPrice` and through the digest harness. Under `expectRevert` the
      cheatcode attached to `getRenewPrice`, which correctly did not revert.
      The rule had been working the whole time.
      So the pattern for T3, T4, T6, T7, T8 and T9 is: `_prepareBatch` FIRST,
      then `vm.expectRevert`, then `hca.validate` and nothing else. The reason
      is written into `_prepareBatch`'s NatSpec so it cannot be lost. A
      refusal case that reports "did not revert" should be suspected of this
      before it is reported as a finding.
- [x] T3. Duration above the bound. REVERT.
      2026-10-22, before the test is written. Read R1 and D4 first. Two
      corrections to this item's wording:
      - The bound is a FIXED value, not a maximum (D4). So test an unequal
        duration in BOTH directions. A duration BELOW the fixed value must
        revert too. The item says "above", which is half the test.
      - The protocol permits a one-second renewal.
        `MIN_RENEW_DURATION` reads 1 on both `ETHRenewerV1` and
        `ETHRegistrar`, confirmed on the fork and recorded in `VERIFY.md`
        item 1. The 28-day floor applies to register only. So the exact-match
        rule in `_checkRenewCall` is the ONLY thing refusing a dust renewal,
        and the below-the-value direction is a real attack, not a formality.
      The check is live: `_checkRenewCall` reverts `PolicyRuleFailed` when
      `rd.duration != renewPolicy.duration`.
      2026-10-22: PASSES, BOTH DIRECTIONS.
        [PASS] test_renew_durationAboveCap_reverts() (gas: 226392)
      Two assertions in one case, as the correction above required:
      - `RENEWAL_DURATION + 1` is refused with `PolicyRuleFailed`.
      - A duration of 1 SECOND is refused with `PolicyRuleFailed`. This is the
        direction the item's wording missed and the one that matters: the
        protocol permits it, `MIN_RENEW_DURATION` being 1 on both contracts,
        and it costs 6 units of MockUSDC. The exact match is the only thing
        refusing a dust renewal, and that is now measured, not argued.
      The money legs are built from the quote for the varied duration, so they
      are internally consistent and the refusal is attributable to the
      duration alone.
- [x] T4. Spend above the cap. REVERT. Record the number for THREAT-MODEL 3.
      2026-10-22: PASSES.
        [PASS] test_renew_spendAboveCap_reverts() (gas: 154385)
      HOW THE CAP IS EXCEEDED without disturbing anything else: a SHORT name.
      `SHORT_LABEL` is `t4ab`, four characters, registered in `setUp` to the
      SAME owner. So the owner binding passes, the duration is exact and the
      name is renewable; the only violation is the price.
      THE NUMBERS, measured on the fork, in MockUSDC's smallest unit, which is
      six decimals:
      - `maxRenewSpend` in the session: 8806051, which is the one-year quote
        for the twenty-character `LABEL`, 8005501, plus a tenth for oracle
        drift per D7.
      - The refused price: 160109598, the one-year quote for the
        four-character `t4ab`.
      So 160.109598 USDC against a cap of 8.806051 USDC, about eighteen times
      over. `setUp` asserts that the short price exceeds the cap, so the case
      cannot silently stop proving anything if the oracle moves.
      FOR THREAT-MODEL 3, and C2 should use these: the per-call bound is the
      cap, 8806051 here. The PERIOD bound is NOT this number; it is the
      owner's remaining ERC-20 allowance, per D6. State both, and do not quote
      the cap as the blast radius.
- [x] T5. Expired, inside grace, owner unchanged. PASS.
      2026-10-22: PASSES.
        [PASS] test_renew_insideGracePeriod_succeeds() (gas: 178132)
      `vm.warp` to expiry plus one day, with `getRemainingGracePeriod`
      asserted non-zero so the warp cannot land outside the window by
      accident. The batch is built AFTER the warp, so the session validity and
      the quote are both current.
      THE ACCESSOR CLAIM IS NOW MEASURED, not argued. Inside the grace window:
      - `getState(labelhash).latestOwner` still returns the owner.
      - `ownerOf(labelhash)` returns the ZERO address.
      Both are asserted in the test. So the choice of accessor is
      load-bearing: `ownerOf` would refuse every renewal in exactly the window
      the product exists for. This is the first half of `VERIFY.md` item 4.
- [x] T6. Third party re-registers, old key retries. REVERT. Strongest test.
      2026-10-22: PASSES.
        [PASS] test_renew_afterReregistration_reverts() (gas: 225695)
      Warped past expiry PLUS the full grace period, with
      `getRemainingGracePeriod` asserted to be 0 so the name has genuinely
      lapsed. A third party then registers it, and `latestOwner` is asserted
      to be the third party. The OLD session, unchanged and still inside its
      own validity, is then refused with `PolicyRuleFailed`.
      So the binding grants no permanent right to a name after the owner loses
      it. The rule corrects itself, because it reads the registry each time
      rather than trusting anything captured at install. That is the claim the
      proposal rests on, and it is now evidence.
      Together with T5 this closes `VERIFY.md` item 4.
- [x] T7. Unauthorized registrar. REVERT.
      2026-10-22: PASSES, for the item as written. One half of my own
      refinement is NOT covered; see the limit below.
        [PASS] test_renew_unauthorizedRegistrar_reverts() (gas: 139035)
      A target holding NO role at the registry root is refused with
      `ActionNotAllowed(rogue, renew.selector)`, asserted with both arguments,
      not just the selector. The test also asserts up front that the rogue
      target really lacks `ROLE_RENEW`, so the case cannot pass for the wrong
      reason.
      WHY THE ERROR MATTERS: `ActionNotAllowed`, not `PolicyRuleFailed`. The
      rule refuses by AUTHORITY, before it looks at the name at all. That is
      the distinction ERD 3.4.1 asks to be kept, and it now shows up in the
      error a caller sees. The approve spender was moved to the rogue target
      too, so the batch is internally consistent and the refusal is about the
      authority and nothing else.
      THE LIMIT, and it is mine to own. I split T7 into two meanings: a target
      with NEITHER role, and a target with `ROLE_REGISTRAR` but NOT
      `ROLE_RENEW`. Only the first is tested. The second has no fixture:
      `ETHRegistrar` holds both roles, and I probed `BatchRegistrar` and
      `ReverseRegistrarAdapter`, which hold neither. Granting
      `ROLE_REGISTRAR` to a fresh address needs `ROLE_REGISTRAR_ADMIN` on the
      live registry, which this project does not hold.
      Two ways to close it, neither done: write it against a LOCALLY deployed
      `PermissionedRegistry` where roles can be granted, labelled clearly as
      a local supplement rather than fork evidence, which is how the existing
      suite already works; or `vm.store` the role bitmap on the fork, which
      depends on storage layout and would be fragile. The first is better.
      It is a narrow gap: the case it misses is a contract that may register
      but may not renew, and D5's whole point is that those are different
      authorities. Worth closing before the proposal, not worth blocking on.
- [x] T8. revokeSessions() then renew. REVERT.
      2026-10-22: PASSES.
        [PASS] test_renew_afterRevokeSessions_reverts() (gas: 108515)
      The batch is prepared FIRST, so the proof carries the nonce that was
      current when the owner authorized the session. The nonce is then bumped
      to 1, and the batch is refused with `InvalidSessionData`.
      `StandaloneSingleOwnerHCA.revokeSessions()` is `onlyOwner` and
      increments `_sessionNonce`, line 220. The validator compares
      `proof.sessionNonce` against the account's current nonce at line 399 and
      reverts `InvalidSessionData` on mismatch. The mock exposes the nonce
      directly, so setting it to 1 reproduces the state one real revocation
      leaves. That is the limit of this case: it exercises the VALIDATOR's
      response to a bumped nonce, not `revokeSessions` itself, which belongs
      to the HCA and has its own tests.
      So one owner transaction ends every outstanding session. Quote that in
      the threat model as the exit.
- [x] T9. v1 name through the wrong registrar. REVERT.
      2026-10-22: PASSES, in the MIRROR of the item's wording.
        [PASS] test_renew_v1NameWrongRegistrar_reverts() (gas: 147431)
      The item says "a v1 name through the wrong registrar". The live fork
      cannot stage that: registration and migration are not open, so there is
      no premigrated v1 name to drive. What it can stage is the mirror, a
      NATIVE v2 name sent to `ETHRenewerV1`, which serves premigrated names
      and refuses this one. The direction is reversed; the mechanism under
      test is the same, a renewal sent to a target that will not renew it.
      THE ERROR IS THE INTERESTING PART. The authority check PASSES, because
      `ETHRenewerV1` holds `ROLE_RENEW`. The refusal is
      `RenewalTargetNotRenewable(LABEL)`, asserted with its argument. So this
      case is the one that justifies D7's third decision: without the
      renewability check, `getRenewPrice` would have reverted
      `NameNotRenewable` and a registrar's error would have surfaced as if the
      policy had failed.
      Three distinct refusal errors now appear across the matrix:
      `PolicyRuleFailed` for the name and the numbers, `ActionNotAllowed` for
      authority, and `RenewalTargetNotRenewable` for a target that will not
      renew. A caller can tell them apart.

## Close out
- [x] C1. All nine pass in one run. Paste the forge output here.
      2026-10-22: ALL NINE PASS IN ONE RUN. This is the contested claim.

      Ran 9 tests for test/unit/hca/AutoRenewPolicy.t.sol:AutoRenewPolicyTest
      [PASS] test_renew_afterReregistration_reverts() (gas: 225738)
      [PASS] test_renew_afterRevokeSessions_reverts() (gas: 108515)
      [PASS] test_renew_durationAboveCap_reverts() (gas: 226558)
      [PASS] test_renew_foreignName_reverts() (gas: 136924)
      [PASS] test_renew_insideGracePeriod_succeeds() (gas: 178132)
      [PASS] test_renew_ownedName_succeeds() (gas: 158100)
      [PASS] test_renew_spendAboveCap_reverts() (gas: 154468)
      [PASS] test_renew_unauthorizedRegistrar_reverts() (gas: 139035)
      [PASS] test_renew_v1NameWrongRegistrar_reverts() (gas: 147431)
      Suite result: ok. 9 passed; 0 failed; 0 skipped; finished in 1.18s

      The whole `test/unit/hca` tree, including the four pre-existing suites:
      133 tests passed, 0 failed, 0 skipped. Nothing was broken to get here.
      Conditions: a fork of Sepolia, chain id 11155111, against the DEPLOYED
      `ETHRegistry` and `ETHRegistrar`, with the modified validator and a mock
      HCA deployed onto the fork. Addresses from `config/networks.ts` through
      `config/export-env.ts`; no address literal in the test.
      TWO LIMITS, both recorded above and neither hidden by this result:
      - T7 covers a target with NO role. It does NOT cover a target with
        `ROLE_REGISTRAR` but not `ROLE_RENEW`, which has no fixture on the
        live registry.
      - T9 runs the mirror of its wording, a v2 name through `ETHRenewerV1`,
        because the fork cannot stage a premigrated v1 name.
      NOT YET DONE, and `ERD.md` section 4 asks for it: re-run the matrix on a
      fork of MAINNET before the proposal. The constants matched between the
      networks on 2026-10-22, so a difference there means something moved.
- [x] C2. Fill THREAT-MODEL.md section 3 from results.
      2026-10-22: DONE. Section 3's table is filled from the nine results, and
      three subsections were added.
      The table now answers all nine questions, plus a tenth row separating
      the per-call bound from the period bound, because conflating them is the
      easiest way to misstate this risk.
      3.1 states the two bounds. The per-call bound is the session cap,
      8.806051 USDC in the test. The PERIOD bound is the owner's remaining
      ERC-20 allowance, which lives in the token and not in this contract, per
      D6. The section says plainly: do not quote the per-call cap as the blast
      radius, because a stolen key can make more than one call.
      3.2 explains why a stolen key cannot renew for dust, with the measured
      numbers: `MIN_RENEW_DURATION` is 1 second, a one-second renewal costs 6
      units, and the FIXED duration is what refuses it rather than the cap.
      3.3 is the honest part. Two rows, transfer and resolver change, are
      REASONED from the policy and NOT measured. No test drives either through
      a renew session. They are marked "Reasoned, not measured" in the table
      with a dash in the test column, and 3.3 gives the reasoning and says to
      add both cases to the matrix if a reviewer wants them measured.
      Everything else in the table cites the test that produced it.
- [x] C3. Mark VERIFY.md item 4 DONE (T5 and T6 close it).
      2026-10-22: DONE. `VERIFY.md` item 4's status line now reads
      "DONE, 2026-10-22. Both halves measured. Tests 5 and 6 pass."
      The evidence was already written into that item over two earlier beats:
      the first half, which accessor the validator can reach, with the
      measurement table showing `getState` finds the owner whatever the low
      bits hold while `latestOwnerOf` does not; and the second half, the grace
      and re-registration behaviour, with `latestOwner` holding through grace
      while `ownerOf` reads zero, and `latestOwner` moving to the third party
      after a lapse. This beat only flipped the status line, so the item no
      longer reads OPEN above its own resolution.
- [x] C4. Port the session-proof construction to TypeScript as `operator/session.ts`.
      Assigned by the operator 2026-10-27. The project is blocked: nothing can
      submit a renewal through the HCA, because a Nexus-style account needs an
      ERC-4337 UserOperation and not a plain signed transaction. The Solidity
      half is done and passing (R2, R3, T1-T9). This item ports ONLY the
      payload construction.
      Scope, from the brief:
      - Pure functions. No network calls. No key loading. No submission.
      - Given the owner key, the session key, the target, the selector and the
        arguments, produce the exact signature payload
        `HCAOwnerAndSessionValidator` accepts.
      - Mirror the Solidity field for field. Every part carries a comment
        naming the fixture file and lines it came from, so the two cannot
        drift.
      - Verify by producing a payload for the SAME inputs as one passing test
        and asserting byte equality against the fixture.
      Boundary: this agent produces the signed payload. `demo` sends it.
      Live stack for the demo path, all from `config/networks.ts` ourStack,
      never hardcoded here:
      HCAOwnerAndSessionValidator, StandaloneHCAFactory,
      StandaloneHCAImplementation, DemoAccount. The account's owner is the
      deployer EOA and it is bound to `autorenewdemo`, which expires
      2026-11-24.
      Source of truth for the port, all at clone commit `3e54cdb8`:
      - `test/unit/hca/AutoRenewSessionFixture.sol` lines 22-45 (constants),
        47-64 (the 15-field proof struct), 66-86 (`_encodeExecutions`),
        132-147 (`_operationHash`), 160-169 (`_signRhinestoneMessage`),
        171-196 (`_packProof`, the 150-byte header).
      - `test/unit/hca/AutoRenewPolicy.t.sol` lines 235-318
        (`_renewEnableProof`, including the 10-field salt), 324-348
        (`_renewEnvelope`, mode 5), 360-395 (`_renewExecutionsFor`, the three
        executions), 398-421 (`_prepareBatch`).
      - `src/hca/HCAOwnerAndSessionValidator.sol` lines 124-146 (the
        IntentExecutor domain and typehashes), 591-628 (`_singleChainDigest`).
      - `src/hca/libraries/HCAOperationHashLib.sol` line 34
        (`ERC7579_ERC1271_MODE`).

      2026-10-27: DONE. The byte-equality check passes.

      What was built:
      - `operator/session.ts`. Pure functions, no network call, no key load,
        no submission. `buildRenewSessionPayload(inputs, keys)` returns the
        executions, the operation data, the permissionId, the digest and the
        envelope. `demo` takes `envelope` and sends it; the boundary is that
        return value.
      - `operator/session.vector.test.ts`. Five assertions, in layers, so a
        failure names the layer that moved and not just "the envelope is
        wrong".
      - `test_emit_typescriptVector` in `AutoRenewPolicy.t.sol`. Builds the
        T1 batch with the SAME `_prepareBatch` the matrix uses, asserts the
        account accepts it, then prints the inputs AND the outputs as one
        JSON line.
      - `scripts/dump-vector.sh` writes that line to
        `operator/vectors/renew-t1.json`.

      Verification, 2026-10-27:
      - `bun test operator/session.vector.test.ts` -> 5 passed, 0 failed.
        The envelope matches byte for byte, 1105 bytes. So do the
        operation data, the permissionId and the digest, each asserted
        separately.
      - `npx tsc --noEmit` clean.
      - `forge test --match-path 'test/unit/hca/*'` -> 134 passed, 0 failed,
        0 skipped, five suites. Was 133; the vector case is the extra one.
        All nine matrix cases still pass, so the emitter altered nothing.

      Two real bugs the check caught, both of which a looser test would have
      let through to the bundler:
      1. Raw-packed addresses carried EIP-55 checksum casing. viem keeps the
         casing of the caller's string and `concatHex` passes it through, so
         the envelope was byte-identical and string-unequal. Solidity has no
         checksum casing. Every raw-packed address now goes through
         `packAddress`, which lower-cases. The ABI encoder does not need it,
         because it left-pads into its own word.
      2. The two uint48 fields in the salt. viem types uint8 through uint48
         as `number`, not `bigint`. The runtime accepted bigints and the
         bytes were right, so only `tsc` found this. Converted at the two
         call sites, with a comment, rather than by widening the interface.

      Anti-drift. The port carries the fixture file and line numbers at every
      part, as asked. The 150-byte header is written out as a field table in
      the `packProof` doc comment with the three R3 fields marked. Both
      `InvalidSessionData` traps R3 hit in Solidity are named where the
      TypeScript could repeat them: the ten-field salt, and the two
      DIFFERENT EIP-712 domains (Smart Sessions for the owner
      authorization, IntentExecutor for the operation digest).

      WHAT THIS DOES NOT PROVE. Three limits, stated rather than rounded up:
      1. The vector's `account` is the test's `MockStandaloneHCA` and its
         `intentExecutor` is `makeAddr("intent-executor")`. Both are inputs
         to the port, so `demo` supplies the live `ourStack.DemoAccount` and
         the deployed validator's own `INTENT_EXECUTOR`. But the byte
         equality is proven at the TEST's values. The construction is
         address-agnostic by inspection; it is not measured at the live
         ones.
      2. Nothing here called the DEPLOYED validator. The claim is "this
         TypeScript matches the Solidity construction byte for byte, and
         that construction is one `MockStandaloneHCA` accepted on a Sepolia
         fork". An `isValidSignature` call against
         `ourStack.HCAOwnerAndSessionValidator` at
         `ourStack.DemoAccount` is UNVERIFIED. That read belongs to the
         submission path, so it is `demo`'s to make.
      3. `validUntil` is `block.timestamp + 1 days` on the fork and feeds
         the salt, so the vector is only self-consistent as a pair. The
         dump script writes inputs and outputs together for that reason.
         Do not hand-edit the JSON.
- [x] C5. Prove the bytecode at the live Sepolia validator is built from this
      clone, and verify its source publicly.
      Assigned by the operator 2026-10-27. The patched
      `HCAOwnerAndSessionValidator` was deployed to Sepolia at
      `0x8012Aa1a220F34f519A902C8f446823E0Dd363E5` earlier the same day.
      Nothing had shown that the code at that address was built from the
      source here, so every on-chain result rested on our word.

      2026-10-27: DONE. The deployed runtime bytecode IS this clone's working
      tree, and the source is now public on Sepolia Etherscan.

      1. BYTECODE COMPARISON. Both are 18,857 runtime bytes.
         `cast code 0x8012Aa1a... --rpc-url $SEPOLIA_READ_RPC_URL` against
         `out/HCAOwnerAndSessionValidator.sol/HCAOwnerAndSessionValidator.json`
         `deployedBytecode.object`, built by `forge build` at the current
         working tree.
         425 bytes differ. EVERY ONE lies inside an immutable slot named in
         the artifact's own `immutableReferences`. Zero bytes differ outside
         those slots. The arithmetic closes exactly: 22 immutable sites x 32
         bytes = 704 covered, of which 440 are the 20 address bytes, less 15
         because `INTENT_EXECUTOR` has five leading zero bytes that already
         match the local all-zero placeholder, giving 425.
         The local build holds all-zero placeholders at all 22 sites, which is
         what an unlinked immutable looks like, so the difference is the
         constructor doing its job and not a source difference.

      2. METADATA HASH. This is the part that makes it proof and not
         resemblance. The CBOR trailer is IDENTICAL in both, byte for byte:
         `a2646970667358221220a304343a26a0a8fde81c40b7cb73cab81feead98024b56da4dea00b15f31a47d64736f6c634300081b`
         It carries the IPFS multihash
         `0x1220a304343a26a0a8fde81c40b7cb73cab81feead98024b56da4dea00b15f31a47d`
         over the metadata JSON, and that JSON holds a keccak hash of each of
         the 73 source files plus the compiler settings. An identical trailer
         therefore commits the deployed bytecode to this exact source set,
         compiled by solc 0.8.27 with the optimizer on at 200 runs, EVM
         version cancun, `bytecodeHash: ipfs`. One changed byte in any of the
         73 files would move it.

      3. WHICH BYTES DIFFER AND WHY. All 425, by slot, read back from the
         deployed getters to confirm the mapping rather than inferred from
         declaration order:
           DEFAULT_REVERSE_REGISTRAR_HCA_ADAPTER 0x1B961e5994EaD11eBcc4E53beeb8a36c91baB436  2 sites
           REVERSE_REGISTRAR_HCA_ADAPTER         0x56Bce5E727FAa9D237341Bb5B9E8a03D5919779d  2 sites
           PERMITTED_RESOLVER_IMPL               0x115eb53F0c60696633855F90b138178Fb40b2b2C  3 sites
           ETH_REGISTRY                          0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4  4 sites
           VERIFIABLE_FACTORY                    0xDa70306C98E97eCe36F997a21368e53298572991  4 sites
           VERIFIABLE_PROXY_LOGIC                0xC41576B4B809B99CF0fF2e5B41b4F147cd9b6BDd  2 sites
           INTENT_EXECUTOR                       0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF  3 sites
           GAS_REFUND_PAYMASTER                  0x1d7df6Ddc7328Ac827EB4D7f171C60AFB7f9A599  2 sites
         `ETH_REGISTRY` equals `addresses.ETHRegistry` for chain 11155111 in
         `config/networks.ts`, so the deployed validator reads the real
         registry.
         There are EIGHT immutables and SEVEN constructor arguments.
         `VERIFIABLE_PROXY_LOGIC` is derived in the constructor, not passed:
         line 244 sets it from `VerifiableFactory(verifiableFactory)
         .proxyLogic()`. Confirmed on chain, not assumed:
         `proxyLogic()` on `0xDa70306C...` returns
         `0xC41576B4B809B99CF0fF2e5B41b4F147cd9b6BDd`, the same value the
         validator holds. A reviewer who counts args against immutables will
         ask about this, which is why it is written down.

      4. DOES THE DEPLOYED CODE CONTAIN THE RENEW RULE? YES. Read from the
         deployed code, by differential build:
           pristine source at HEAD `3e54cdb8`, renew rule absent:
             16,519 runtime bytes, metadata ipfs `f74487b3c9...`
           working tree, renew rule present at lines 212, 733 and 1008:
             18,857 runtime bytes, metadata ipfs `a304343a26...`
           DEPLOYED at 0x8012Aa1a...:
             18,857 runtime bytes, metadata ipfs `a304343a26...`
         The deployed code matches the PATCHED build and not the unpatched
         one. It is 2,338 bytes larger than the validator without the rule.
         The pristine build was made by `git checkout HEAD --` on the two
         changed `src` files with `forge build --skip test`, then both files
         were restored from `/tmp/ar-c5-backup`. `git status` after:
         both still modified, renew rule present. The working tree was
         rebuilt and the artifact re-checked identical to the capture used
         in step 1.
         NEGATIVE RESULT WORTH RECORDING, because it looks like evidence and
         is not: grepping the deployed hex for the literal selectors
         `0c8b8bba` (`RenewalTargetNotRenewable(string)`) and `2d06649b`
         (`IETHRenewer.renew`) finds NEITHER - and finds neither in the local
         build of the patched source either. The constant optimizer re-encodes
         those pushes. So selector absence proves nothing, and anyone citing a
         selector grep as proof of presence or absence is wrong. The metadata
         hash and the differential build are the evidence.

      5. PUBLIC VERIFICATION. `Pass - Verified` on Sepolia Etherscan.
         https://sepolia.etherscan.io/address/0x8012aa1a220f34f519a902c8f446823e0dd363e5
         Read back with `action=getsourcecode`: contract name
         `HCAOwnerAndSessionValidator`, compiler `v0.8.27+commit.40a35a09`,
         optimizer on, 200 runs, EVM version cancun, not a proxy, ABI
         present. A reviewer can now read the source without trusting us.
         `forge verify-contract` FAILED first, and the reason matters for
         anyone repeating this: its `--show-standard-json-input` emits 72
         sources, not 73. It resolves `ERC165.sol` and `IERC165.sol` through
         the v5 OpenZeppelin path and omits the v4 ones, because it does not
         apply the context-dependent remapping
         `lib/ens-contracts/:@openzeppelin/contracts/=lib/openzeppelin-contracts-v4/contracts/`
         when it collects sources. Etherscan answered
         `Source "lib/openzeppelin-contracts-v4/contracts/utils/introspection/ERC165.sol" not found`.
         The input that worked was built from the deployment record's own
         `metadata` object: `settings` verbatim, minus `compilationTarget`,
         plus an `outputSelection`, and the 73 sources with their on-disk
         content. Compiling it locally with
         `~/Library/Application Support/svm/0.8.27/solc-0.8.27 --standard-json`
         reproduces the `forge build` runtime bytecode EXACTLY, metadata
         trailer included, so the submitted input is checkable rather than
         merely accepted. Saved at
         `contracts/deployments/sepolia-autorenew/HCAOwnerAndSessionValidator.verify-input.json`.

      6. CONSTRUCTOR ARGUMENTS AND WHERE THEY CAME FROM. A verification that
         needs undocumented args is not reproducible, so: the ABI-encoded
         blob is `argsData` in
         `contracts/deployments/sepolia-autorenew/HCAOwnerAndSessionValidator.json`,
         written by the deploy at tx
         `0xd17cc7f7fcc69034dac941abb77961dddacaef777b732a1c0ff66c3407eeb8c1`,
         block `0xb73782`, origin `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31`.
         Seven addresses, in constructor order (source lines 229-237):
           1 defaultReverseRegistrarHcaAdapter 0x1b961e5994ead11ebcc4e53beeb8a36c91bab436
           2 reverseRegistrarHcaAdapter        0x56bce5e727faa9d237341bb5b9e8a03d5919779d
           3 permittedResolverImpl             0x115eb53f0c60696633855f90b138178fb40b2b2c
           4 ethRegistry                       0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4
           5 verifiableFactory                 0xda70306c98e97ece36f997a21368e53298572991
           6 intentExecutor                    0x00000000005ad9ce1f5035fd62ca96cef16adaaf
           7 gasRefundPaymaster                0x1d7df6ddc7328ac827eb4d7f171c60afb7f9a599
         Independently cross-checked against the deployed immutable getters
         in step 3, so the args are not taken on the record's word either.
         Etherscan echoes the same blob under `ConstructorArguments`.

      7. ENS OFFICIAL RECORDS UNTOUCHED. `git status contracts/deployments/`
         in the clone lists only the untracked `sepolia-autorenew/`.
         `contracts/deployments/sepolia/` shows no modification.

      WHAT THIS DOES NOT PROVE. The proof is about the CODE at that address.
      It says nothing about who can call it or what state it points at beyond
      the eight immutables read above. It also does not re-run the nine-case
      matrix against the deployed validator: the matrix runs on a Sepolia
      fork against a locally deployed harness, and C4 note limit 2 still
      stands - no `isValidSignature` call has been made to the deployed
      validator at `ourStack.DemoAccount`. That remains UNVERIFIED.

      CLEANUP. Read `operator/vectors/README.md`, written by the operator. Its
      rule is now in force for anything added to that directory: a vector
      there must never carry a key that controls anything. A future vector
      needing a funded account stores the ADDRESS and leaves the key in
      `.env`. No further vector was added this beat, so nothing there changed.
- [x] C6. Find the real submission path for a session execution against a live
      Rhinestone-backed HCA, and say whether a real renewal on live Sepolia is
      possible.
      Assigned by the operator 2026-10-27, after demo found that the live
      executor exposes neither `executeWithSession` nor
      `executeWithSessionAndRefund`.

      2026-10-27: DONE. ANSWER (a). A live renewal is possible with the stack
      we already deployed, by a PERMISSIONLESS DIRECT CALL. No Rhinestone API
      key, no bundler, no EntryPoint. The path is below, and so is what is
      still unfired.

      FIRST, THE PREMISE IS WRONG, AND IT WAS LOAD BEARING. demo's measurement
      is correct and its conclusion is not. `executeWithSession` and
      `executeWithSessionAndRefund` do not exist, but the executor is not
      inert: `0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF` is a PROXY whose own
      verified ABI holds only `implementation`, `owner`, `renounceOwnership`,
      `transferOwnership` and `upgradeTo`. Its `implementation()` returns
      `0x194DE341d4791e9b8922eE1bC018DFd1fD1b115A`, verified on Sepolia
      Etherscan as `IntentExecutor`, with 22 functions. The real entry points
      are named `executeSinglechainOps` and
      `executeSinglechainOpsWithGasRefund_ERC20`. An empty revert on
      `executeWithSession` is an unmatched selector at the implementation's
      dispatcher, which is exactly what a wrong NAME looks like. Nothing was
      guessed and no selector was brute forced: the names come from the
      verified source read through the Etherscan API.

      THE TRANSPORT contracts-v2 ITSELF USES. `script/liveHcaRhinestoneRegistration.ts`,
      read end to end for its transport. It does NOT use a direct call,
      `EntryPoint.handleOps`, or a public bundler. It is the Rhinestone
      ORCHESTRATOR intent service:
        line 227   `if (!RHINESTONE_API_KEY) throw`
        line 953   `new RhinestoneSDK({ auth: { mode: "apiKey", apiKey } })`
        line 3472  `account.prepareTransaction(transaction)` -> `prepared.intentRoute.intentOp`
        line 3653  `account.signTransaction(prepared)`
        line 3727  `account.submitTransaction(signed, [])`
        line 3745  `account.waitForExecution(result, false)`
      In the SDK at `@rhinestone/sdk@1.8.0`, `submitTransaction` calls
      `submitIntent`, which posts to `PROD_ORCHESTRATOR_URL`
      `https://v1.orchestrator.rhinestone.dev`
      (`dist/src/orchestrator/consts.js`). The orchestrator's own relayer then
      makes the on-chain call. A separate bundler path exists
      (`submitUserOperation` -> `submitUserOp`, commented "Smart sessions
      require a UserOp flow") and needs `pimlico`, `biconomy` or a `custom`
      bundler URL (`dist/src/accounts/utils.js` lines 141-151). We hold
      neither credential: the root `.env` has no `RHINESTONE_API_KEY` and no
      bundler key.
      WHO SIGNS WHAT on that path: the session key signs the ERC-1271
      envelope. The SDK builds the same envelope this project builds, at
      `dist/src/execution/utils.js:1111`,
      `packStandaloneHcaFixedSessionSignature`, which packs mode `0x04` or the
      refund variant and prefixes `zeroAddress`. The orchestrator relayer only
      transports it and is paid by the gas refund.

      WHY WE DO NOT NEED THAT SERVICE. `executeSinglechainOpsWithGasRefund_ERC20`
      in the verified `src/executor/StandaloneIntent/StandaloneIntent.sol` at
      line 414 is declared `external nonReentrant` with NO access control, no
      owner check and no trusted-relayer check. It authenticates the CALLDATA,
      not the caller: `_checkSigAndExecute` at line 658 consumes the nonce,
      requires `_isValidSignature(account, LOCKTAG, digest, hash, ops,
      signature)`, then runs `LibERC7579.executeOps(account, ops)`. Any EOA
      may carry a validly signed bundle. The orchestrator is a convenience,
      not a gate.

      FOUR ON-CHAIN READS THAT SAY THE DEPLOYED STACK IS WIRED FOR THIS.
      Measured, not inferred:
      1. The executor's EIP-712 domain is `name = "IntentExecutor"`,
         `version = "v0.0.1"` (`_domainNameAndVersion`, StandaloneIntent.sol
         line 699). Our validator hashes exactly those two strings
         (`INTENT_EXECUTOR_NAME_HASH`, `INTENT_EXECUTOR_VERSION_HASH`), and
         `operator/session.ts` reproduces the digest from them. The digest our
         C4 module builds is the digest this executor checks.
      2. `isModuleInstalled(2, 0x00000000005aD9ce...)` on the live DemoAccount
         `0xe4F6BBcf33656d55Cc50Cf2FAD344C208243031F` returns TRUE. The
         executor is installed as an ERC-7579 executor module, so
         `LibERC7579.executeOps` clears the account's `onlyExecutorModule`
         gate (`StandaloneSingleOwnerHCA.sol` line 116).
      3. The account routes ERC-1271 to an IMMUTABLE default validator and
         requires the first 20 signature bytes to be ZERO
         (`isValidSignature`, lines 265-290; a non-zero prefix reverts
         `ValidatorNotInstalled`). Read from the deployed implementation
         `0x9E2deb6Fb870afF73460D45314e5D73865f82D51` by extracting its
         immutables from `cast code` against the artifact's
         `immutableReferences`: the default validator is
         `0x8012aa1a220f34f519a902c8f446823e0dd363e5`, OUR PATCHED VALIDATOR,
         at 5 sites, and the intent executor immutable is
         `0x00000000005ad9ce1f5035fd62ca96cef16adaaf` at 2 sites. Also present:
         EntryPoint v0.7 `0x0000000071727de2...`, our `HCAUpgradeSet`
         `0x19ec1e0f...`, and our factory as the owner registry
         `0xe4e3738f...`.
         NOTE for anyone repeating this: `isModuleInstalled(1, validator)`
         returns FALSE and that is NOT a problem. The default validator is a
         bytecode immutable, not an installed module. Reading that false as
         "our validator is not wired in" would be the mirror of demo's error.
      4. `isInitialized(DemoAccount)` on the executor returns FALSE, which is
         also not a problem: the verified source documents that function as
         "Always returns false in current implementation".

      THE EXACT CALL PATH.
        our EOA (DEPLOYER_PRIVATE_KEY, pays Sepolia ETH gas)
          -> IntentExecutor proxy 0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF
             .executeSinglechainOps(SingleChainOps)                  [no refund]
             or .executeSinglechainOpsWithGasRefund_ERC20(SingleChainOps, GasRefund, recipient)
          -> delegates to impl 0x194DE341d4791e9b8922eE1bC018DFd1fD1b115A
          -> _checkSigAndExecute: consume nonce, then
             DemoAccount.isValidSignature(digest, 20 zero bytes || envelope)
          -> HCAOwnerAndSessionValidator 0x8012Aa1a... isValidSignatureWithSender,
             msg.sender == the executor, which satisfies CallerNotIntentExecutor
          -> our renew rule checks the batch
          -> LibERC7579.executeOps runs the three executions on the account:
             transferFrom owner -> HCA, approve ETHRegistrar, renew
        The envelope is what `operator/session.ts` already produces (C4).

      WHAT IS NOT YET DONE, AND WHY THIS IS NOT A CLAIM THAT WE RENEWED.
      No renewal has been fired and no `eth_call` simulation of the above has
      been run. The path is established by verified source and on-chain reads;
      end to end execution is UNVERIFIED. Four specific gaps, each small and
      each named rather than waved at:
      1. `operator/session.ts` returns the BARE envelope. The account needs 20
         leading zero bytes, which the Rhinestone SDK adds with
         `concat([zeroAddress, ...])`. Our module must add them, or the caller
         must. One line, but today the payload would revert
         `ValidatorNotInstalled`.
      2. The `SingleChainOps` struct and its `hashAndDecode` packing are the
         executor's, not ours. Our `operationData` must match
         `Types.Operation` as `packIntentOperation` builds it. The C4 digest
         matching the executor's DOMAIN does not by itself prove the OPS
         encoding matches.
      3. The ERC-20 gas-refund route is the harder of the two. The verified
         source says execution-emissary modes settle via
         `settleGasRefund_requireCallback`, and the account must call
         `Paymaster.callbackAllowMaxAmount` DURING execution to cap the
         refund. Our three-execution batch contains no such call, and the
         renew rule would refuse a fourth execution it does not recognise.
         `executeSinglechainOps` with no refund avoids this entirely, and our
         validator already has a no-refund digest branch
         (`NO_GAS_REFUND_HASH`). Prefer the no-refund entry point.
      4. Funding. The name owner must hold MockUSDC and approve the HCA for at
         least the quoted price, and our EOA needs Sepolia ETH for gas. Not
         checked this beat.

      SO, STRICTLY: (a) is the answer to "what is the path" and "is it
      possible with what we deployed". It is NOT yet the answer to "have we
      done it". Until a transaction lands, the honest public evidence remains
      what (c) describes - the test matrix, the deployed verified contracts,
      and the byte-equal TypeScript port - plus this: the submission path is
      identified, permissionless, and the deployed account is already wired to
      the executor and to our validator.

      The demo agent should be told that its two names were wrong and its
      measurement was right, and that the executor is live, permissionless and
      already installed on our account. The blocker it reported does not
      exist.
- [x] C7. Close the two C6 gaps that live in `operator/session.ts`, and
      simulate the full path against the live DemoAccount.
      Assigned by the operator 2026-10-27. Gaps 3 and 4 are demo's and were
      left alone.

      2026-10-27: DONE. GAP 1 CLOSED AND PROVEN LIVE. GAP 2 BUILT BUT NOT
      PROVEN; the simulation refuses it and the honest answer is that the ops
      encoding is still UNVERIFIED.

      THE HEADLINE. The live DemoAccount
      `0xe4F6BBcf33656d55Cc50Cf2FAD344C208243031F` ACCEPTED a payload this
      module produced. `eth_call` of
      `isValidSignature(digest, accountSignature)` with `from` set to the
      intent executor returned `0x1626ba7e`, the ERC-1271 magic value.
      That single read proves, on live Sepolia and not on a fork:
        - the 20 zero bytes are right (gap 1),
        - the digest matches what the DEPLOYED validator computes,
        - the proof, the ten-field salt and the permissionId are right,
        - the renew rule ACCEPTED the three-execution batch for
          `autorenewdemo` against the live registry and the live price,
        - the no-refund settlement shape is accepted.
      Inputs were live reads, not constants: `getRenewPrice` returned
      8005501, and `ownerAndSessionNonce` on the account returned owner
      `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31` and session nonce 0. The
      proof must carry that exact nonce or the validator refuses it.

      GAP 1, what was added. `ACCOUNT_SIGNATURE_PREFIX` and
      `accountSignature(envelope)` in `operator/session.ts`, plus an
      `accountSignature` field on the payload. The bare `envelope` is
      UNCHANGED and still what the C4 vector asserts, exactly as instructed:
      the prefixed form is a separate export, not a silent edit.
      Authority for the prefix is both sides: the account's
      `isValidSignature` (clone `3e54cdb8`, lines 265-290) reverts
      `ValidatorNotInstalled` unless `signature[:20]` is zero and then
      forwards `signature[20:]`; and the SDK does the same at
      `dist/src/execution/utils.js:1104`,
      `concat([zeroAddress, encodePacked(...)])`.

      GAP 2, what was found, and it is NOT what C6 assumed. There are TWO
      encodings of the same executions on this path, not one:
        - in the SIGNATURE: the compact form,
          `vt[0:2] || uint8(count) || [to(20) || uint24(len) || data]...`.
          Our validator decodes this, and the SDK builds byte-identical bytes
          in `packIntentOperation` (`dist/src/execution/utils.js:741-766`).
          Already proven by C4.
        - in the EXECUTOR'S CALLDATA: `0x02 || 0x01 || abi.encode(Execution[])`.
          The verified `SmartExecutionLib.encode` builds it that way, and
          `safeToERC7579` decodes it with `decodeBatchUnchecked`, which wants
          ABI encoding and NOT the compact packing.
      So C6's gap 2 was mis-stated: the two encodings are not supposed to be
      equal, they are supposed to HASH equal. `encodeExecutorOpsData` builds
      the second form and the payload now carries it as `executorOpsData`.
      Byte 0 is the exec type and byte 1 the sig mode, from the verified
      `SmartExecutionLib`: `Type { Eip712Hash, Calldata, ERC7579, MultiCall }`
      makes ERC7579 = 2 and `SigMode { EMISSARY, ERC1271, ... }` makes
      ERC1271 = 1. `0x0201` is literally "ERC-7579 executions, ERC-1271
      signature", which is what our `ERC7579_ERC1271_MODE` names.

      FOUR TYPEHASHES CONFIRMED IDENTICAL between our validator and the
      verified executor's `EIP712Lib` / `EIP712TypeHashLib`. Computed from the
      type strings and compared to the executor's literals:
        SingleChainOps 0xbae11135c33effc421d699bbb53d9926a005ed0f2f5eb672c62cbfa943807291
        GasRefund      0x0bf04d9dcc5e703a75ba16d19c00f9d87fa30b9a815627102c15624d338eb094
        NO_GASREFUND   0x44db4de84d423abe696e354fc99de162153ee2f8985ab84305061247a78a3be4
        Op             0xdbc520cb50a8aaf3fa06ea43dc3d59d248e52ae638476e3268a1e6e36bffe196
        Ops            0x09b0a32e9842b65559835c235891737e06927d59e48a6f0e0512e136a513a9e4
      `hashSingleChainOps` is keccak(typehash, account, nonce, opsHash,
      gasRefundHash), the same five-word shape our `_singleChainDigest` uses,
      and the nonce is a plain `SingleChainOps.nonce` struct field, not
      something buried in the ops bytes.

      THE NO-REFUND SHAPE IS SUPPORTED, and the earlier test comment that it
      is not was about the PROOF, not the refund. Both are true at once:
      lines 396-404 refuse a proof whose `refundToken`,
      `maxRefundExchangeRate` or `maxRefundAmount` is zero, so the session
      authorization must carry non-zero MAXIMA; and `_checkGasRefund` lines
      1141-1146 explicitly `return` when the ACTUAL refund is all zero. So
      `settlement: "none"` keeps the maxima in the proof and sends an all-zero
      `GasRefund`, the digest takes the `NO_GAS_REFUND_HASH` branch, and that
      is the same `NO_GASREFUND` constant `executeSinglechainOps` passes. The
      live `isValidSignature` above was run in exactly this shape, so this is
      measured, not argued.

      SIMULATION RESULT, both steps, reported as they came back:
        [1] account.isValidSignature  -> 0x1626ba7e  ACCEPTED
        [2] executor.executeSinglechainOps -> REVERT, EMPTY return data
      Context for [2], all read live: the proxy does delegate (its
      `LOCKTAG`, `SAMECHAIN_ARBITER` and `eip712Domain` all answer through
      it, and the domain reads back "IntentExecutor" / "v0.0.1"), and
      `isStandaloneIntentNonceConsumed(1, account)` is false, so it is not a
      spent nonce. Calldata was 2308 bytes.
      An EMPTY revert is not `InvalidSignature()`, which is a custom error and
      would carry its selector. That points below the signature check, and
      since everything ABOVE it is now proven live by step [1], the prime
      suspect is the one thing still unproven: the `ops.data` ABI encoding
      reaching `decodeBatchUnchecked`. I am NOT asserting that. It is a
      hypothesis with one candidate, and the next beat should get a real trace
      rather than another guess.

      SO, PLAINLY, AS ASKED: I CANNOT produce an authoritative vector for the
      ops encoding. The executor's libraries are not vendored in this clone,
      so there is no local Solidity build to compare against, and the only
      authority available was the live call - which REFUSED it. The vector
      test asserts what can honestly be asserted about `executorOpsData`: that
      it is deterministic, that it carries `0x0201`, and that it is NOT the
      same bytes as `operationData` so nobody later collapses the two. It does
      NOT assert agreement with the executor, and a comment in the test says
      so.

      VERIFICATION. `bun test operator/session.vector.test.ts` -> 9 passed,
      0 failed, 22 assertions. The four original C4 assertions still pass
      unchanged, including the bare-envelope byte equality, plus: the bare
      form is unchanged by the prefix; `accountSignature` is 20 zero bytes
      then the identical envelope, and stripping the prefix returns the vector
      byte for byte; `executorOpsData` is deterministic and distinct; and the
      no-refund shape zeroes the actual refund while keeping the proof maxima.
      `npx tsc --noEmit` reports no error in `operator/session.ts`.
      NOTE for the operator: `tsc` DOES fail, in three files that are not
      mine - `operator/submit.ts`, `operator/submit.fork-check.ts`,
      `operator/submit.mock-fork-check.ts`. They are demo's and they still
      call `executeWithSessionAndRefund`, the function C6 showed does not
      exist. I did not touch them.

      The simulation script is `operator/c7-simulate.ts`. It is read-only, it
      signs with `DEPLOYER_PRIVATE_KEY` and `SESSION_PRIVATE_KEY` from `.env`,
      and it sends nothing. Kept because demo will want it.
- [x] C8. Answer VERIFY.md item 3: does the fallback need a resolver
      role grant, or is it session-driven?
      Assigned by the operator 2026-10-27, after the real renewal landed in tx
      `0x5c8e9a9d1b3a7ba0235377c85f251e9dad40a2900dd206b7341a96fa7051eb95`.

      2026-10-27: DONE. The answer is NEITHER of the two options as item 3
      frames them, and ERD.md section 5 is WRONG as written. `setAddress` is
      already in the policy's allowlist, so no new validator rule is needed
      for the SELECTOR - but the policy imposes two conditions the ERD does
      not mention, and the resolver imposes a third. Item 3 does NOT close as
      "not needed".

      1. THE POLICY ALREADY PERMITS THE SELECTOR.
         `HCAResolverPolicyLib._isRecordSelector` (clone `3e54cdb8`, lines
         192-199) lists `IAddressSetter.setAddress.selector` alongside
         `linkToRecord`, `linkToNode`, `setABI`, `setContenthash` and
         `setData`. `checkCall` also recurses through
         `IMulticallable.multicall`. So the validator needs no new rule to
         allow a session to set an address. That part of ERD section 5 holds.

      2. CONDITION THE ERD MISSES: THE SESSION MUST NAME THE RESOLVER.
         The resolver branch is `if (allowedResolver != address(0) &&
         execution.target == allowedResolver)` at line 741, and
         `allowedResolver` is `proof.resolver`, passed at line 647 from
         `_checkStatelessRegistrationPolicy`. Our renew proof sets
         `resolver = address(0)` deliberately, because a renewal touches no
         resolver. So a `setAddress` execution under THE SESSION WE BUILT AND
         FIRED TODAY falls past every branch and hits
         `revert ActionNotAllowed` at line 800.
         MEASURED on the live validator `0x8012Aa1a...`, not reasoned:
         `eth_call` of `isValidSignature` on the live DemoAccount with a
         `setAddress` execution under a `resolver = 0` proof returned
         `0xffffffff`, refused. Compare C7, where the same probe shape with a
         renew batch returned `0x1626ba7e`.
         This is a SESSION-SHAPE requirement, not a contract change. The
         fallback needs its own session whose proof names the resolver. That
         is frontend and operator work, not a PR to ENS.

      3. CONDITION THE ERD MISSES: WHICH RESOLVER IS ACCEPTABLE.
         `HCAResolverPolicyLib.checkBinding` lines 54-88 requires
         `IVerifiableFactory(VERIFIABLE_FACTORY).verifyContract(resolver)` to
         return EXACTLY `PERMITTED_RESOLVER_IMPL`, which on our deployment is
         `0x115eb53F0c60696633855F90b138178Fb40b2b2C` (read from the deployed
         validator in C5). Anything else is `PolicyRuleFailed`. So the
         session-driven fallback only works on a name whose resolver is a
         `VerifiableFactory` proxy of that implementation. The shared
         ENS-deployed `ENSV2Resolver` would be refused.

      4. THE ROLE GRANT API, which item 3 asked for, and its SCOPE, which
         item 3 states incorrectly.
         The call is `grantRoles(uint256 resource, uint256 roleBitmap,
         address account)` on the resolver, from
         `src/access-control/EnhancedAccessControl.sol` line 120, declared in
         `IEnhancedAccessControl` line 66. There is also
         `grantRootRoles(uint256 roleBitmap, address account)` at line 134 and
         `hasRoles(uint256,uint256,address)` at line 185 to read it.
         The role is `PermissionedResolverLib.ROLE_SET_ADDRESS = 1 << 0`, and
         its admin is `ROLE_SET_ADDRESS_ADMIN = ROLE_SET_ADDRESS << 128`.
         THE SCOPE IS NOT THE NAME. `PermissionedResolver.setAddress` lines
         164-170 is `onlyRoles(PermissionedResolverLib.resource(coinType),
         ROLE_SET_ADDRESS)`, and `resource(uint256 x)` lines 74-79 is
         `keccak256` of the COIN TYPE. So a grant authorises
         (resolver instance, coinType), not (name). On a per-name resolver
         proxy that is the same thing in practice; on a SHARED resolver one
         grant would cover every name it serves. Item 3's phrase "one named
         role on one name to one address" cannot be satisfied as written,
         and anyone designing from that sentence will over-trust the grant.

      5. WHO WOULD HOLD THE ROLE, AND WHY A NAME REGISTERED THROUGH THE HCA
         NEEDS NO GRANT.
         Executions run AS THE ACCOUNT, so `msg.sender` at the resolver is
         the HCA, not the owner EOA. For a resolver deployed through the HCA
         register path, `HCAResolverPolicyLib.checkDeployment` already
         "requires full resolver access for both the HCA and its owner at
         initialization", so the HCA holds `ROLE_SET_ADDRESS` from birth and
         no later grant is needed. For a resolver the owner deploys or sets
         independently, the owner holds the admin role and must call
         `grantRoles` once for the HCA.

      6. OUR DEMO NAME CANNOT DO IT AT ALL TODAY, measured.
         `getResolver("autorenewdemo")` on the live ETHRegistry
         `0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4` returns
         `0x0000000000000000000000000000000000000000`. The name has NO
         resolver. `getState` confirms owner
         `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31` and expiry 1827111780.
         The name was registered by the EOA directly, not through the HCA, so
         there is no HCA-deployed resolver proxy and no role. A fallback demo
         on this name needs a conforming resolver deployed and set FIRST.

      WHAT I COULD NOT MEASURE, stated rather than rounded up.
      I ran a second live probe with the proof NAMING a resolver, to show the
      policy accepts `setAddress` once the session is shaped right. It was
      REFUSED, and the refusal is MY PROBE'S FAULT, not a finding: I passed
      `StandaloneHCAImplementation` as the resolver address, which is not a
      `VerifiableFactory` proxy of `PERMITTED_RESOLVER_IMPL`, so
      `checkBinding` refuses it exactly as item 3 above predicts. That probe
      is INCONCLUSIVE about `setAddress`. Making it conclusive needs a
      conforming resolver proxy deployed on Sepolia, which is a state change
      and is demo's to make. So:
        - "the policy allowlists the selector" is READ from source, confirmed.
        - "a resolver=0 session cannot set an address" is MEASURED live.
        - "a resolver-naming session CAN set an address" is NOT measured. It
          follows from reading lines 741-747, and it should be measured before
          it reaches a proposal.
      The probe is `operator/c8-probe.ts`, read-only, sends nothing. Its case
      B is left in place with this caveat rather than deleted, so the next
      agent sees what was tried.

      FOR EVIDENCE, what to record in VERIFY.md item 3. I do not write that
      file.
        Status: the fork is RESOLVED toward a session-driven fallback, but
        NOT "role grant not needed". Suggested status line:
        "RESOLVED, 2026-10-27. Session-driven, with two preconditions. The
        role-grant API exists and is needed only when the resolver was not
        deployed through the HCA."
        Record: (i) the policy allowlists `setAddress`; (ii) the session's
        proof must name the resolver, measured live by refusal under
        `resolver = 0`; (iii) the resolver must be a `VerifiableFactory`
        proxy of `PERMITTED_RESOLVER_IMPL`; (iv) the grant call is
        `grantRoles(resource, roleBitmap, account)` with
        `ROLE_SET_ADDRESS = 1 << 0`, and the resource is the COIN TYPE, not
        the name, so item 3's current wording should be corrected; (v) names
        registered through the HCA need no grant; (vi) `autorenewdemo` has no
        resolver, so the fallback demo needs one deployed first.
        Also worth a line: ERD.md section 5's "no contract change" is
        CORRECT, and that is the good news - the two preconditions are
        session shape and resolver provenance, neither of which is a PR to
        ENS. D12 stays frontend and operator work. The ask to ENS does NOT
        grow a second rule.
- [x] C9. What happens to EXISTING ENSv2 HCA users if this rule ships?
      Assigned by the operator 2026-10-27, after ENSv2 went live on mainnet.

      2026-10-27: DONE. The honest headline is NOT "no change for everyone".
      It is: no existing account changes behaviour UNLESS its owner chooses to
      upgrade, and an owner who DOES upgrade invalidates every session
      authorization they had already signed. The second half is a real
      behavioural change, it is measurable, and it is not in ERD.md or
      THREAT-MODEL.md today.

      PART 1. THE UPGRADE MECHANISM. Existing accounts do NOT follow a new
      implementation automatically. Three independent gates, all read from
      source and confirmed on chain:
      a. The account is an ERC-1967/UUPS proxy. Measured: the implementation
         slot `0x360894a1...bbc` on the live DemoAccount
         `0xe4F6BBcf33656d55Cc50Cf2FAD344C208243031F` holds
         `0x9e2deb6fb870aff73460d45314e5d73865f82d51`, and
         `proxiableUUID()` on that implementation returns the same slot
         constant. So each account stores its OWN implementation pointer.
         Nothing a deployer does later moves it.
      b. `StandaloneSingleOwnerHCA._authorizeUpgrade` (clone `3e54cdb8`,
         lines 371-375) is `internal view override onlyOwner` AND requires
         `UPGRADE_SET.includes(newImplementation)` or it reverts
         `UpgradeTargetNotApproved`. `UPGRADE_SET` is an immutable set at
         construction. So the ACCOUNT OWNER must send the upgrade, and the
         target must already be allowlisted.
      c. `UPGRADE_SET` is a `PermissionedAddressSet`. Its `approve(address,
         bool)` is `onlyRootRoles(ROLE_APPROVE)`
         (`src/utils/PermissionedAddressSet.sol` line 52). On ENS mainnet that
         role is the DAO's; on OUR Sepolia set
         `0x19ec1e0f3b99364cf6a294552ef4a129dfe341c7` the deployer EOA
         `0x41baA860cf727eAbbbE5f469E0cF5A0833148F31` holds root roles,
         measured with `hasRootRoles(1, deployer)` = true.
      d. A FOURTH gate, worth naming because a reviewer will look for it: the
         TARGET implementation independently decides which predecessors may
         upgrade into it, via `PREDECESSOR_UPGRADE_SET` and
         `isValidPredecessor` (lines 304-318). A zero predecessor set rejects
         every predecessor.
      So the answer to "who can trigger it and who must consent" is: the role
      holder on the upgrade set consents by allowlisting, and the account
      owner consents by transacting. Neither alone is enough. There is NO
      mechanism by which shipping this rule reaches an account whose owner
      does nothing.
      Measured corollary, and it surprised me: `HCAUpgradeSet.includes(
      0x9E2deb6F...)` is FALSE. Our own implementation is not an approved
      upgrade TARGET. The DemoAccount runs it because the factory set it at
      construction, not by upgrade. So even our own account could not upgrade
      to our own implementation through the allowlist path as it stands.

      PART 2. THE NO-OPT-IN CASE. Two claims, and they are not the same
      strength.
      CLAIM A, SOLID: no pre-existing branch of the if-chain was modified.
      The whole diff against HEAD `3e54cdb8` is 203 insertions and 5
      deletions across two `src` files. ALL FIVE deleted lines, in full:
        1. `_SESSION_PROOF_HEADER_LENGTH = 110` -> `150`
        2. `true` -> `true,`            (argument list gains a parameter)
        3. `bool requireAction` -> `bool requireAction,` + `RenewPolicy memory renewPolicy`
        4. the `sessionToEnableIndex` decode line, extended with the three
           new field decodes
        5. `proof.maxRefundAmount` -> `proof.maxRefundAmount,` + the three
           new salt fields
      Items 2 and 3 are signature plumbing. Items 4 and 5 extend a decode and
      a hash. NO branch body, NO condition and NO revert of any pre-existing
      rule was edited. `_checkPaymentTokenApproval` appears ZERO times in the
      diff, so D8 held exactly as intended: the renew path got its own
      `_checkRenewMoneyCall` and the pre-existing approval path cannot widen,
      because it was not touched.
      The new money branch is an INSERTION placed before the pre-existing
      funding branch, and its FIRST condition is
      `renewPolicy.paymentToken != address(0)`. `renewPolicy` is built from
      `proof.renewPaymentToken`, which is zero for any session that does not
      enable auto-renew, so that session short-circuits on one comparison and
      reaches the pre-existing branches unchanged.
      The one line added after the loop, `_checkRenewBatch(state)`, is inert
      without a renewal: lines 939-946 return immediately when
      `state.renewed` is false, and the only code that can set
      `renewApproved` or `renewPulled` is `_checkRenewMoneyCall`, which that
      same zero-token guard makes unreachable.
      WHAT A MALICIOUS CALLER WOULD HAVE TO PRODUCE to reach the new code,
      spelled out because "additive" is an argument and this is the test of
      it. All of the following, together:
        - a 150-byte proof header whose `renewPaymentToken` is non-zero;
        - a `permissionId` equal to the validator's own derivation from the
          TEN-field salt over that proof, so the three renew fields are
          inside the hash;
        - an owner ECDSA signature over the Smart Sessions multi-chain digest
          for that salt, bound to THIS account address;
        - a session-key signature over the IntentExecutor digest for the
          batch;
        - `proof.sessionNonce` equal to the account's CURRENT
          `ownerAndSessionNonce`, so `revokeSessions()` invalidates it;
        - and for the renew case itself, a target holding `ROLE_RENEW` on the
          registry, a name whose `getState().latestOwner` is the account
          owner, an exact duration and token match, and a quote at or under
          the cap.
      The first three are the barrier. Reaching the renew code requires the
      OWNER'S OWN SIGNATURE over a salt that commits to a non-zero renew
      payment token. A user who never enables auto-renew never produces one,
      and no caller can forge it without the owner key.
      CLAIM B, AND IT REFUTES "LITERALLY NO BEHAVIOURAL CHANGE": an existing
      user WITH A LIVE SESSION who upgrades finds that session REFUSED.
      Two independent reasons, both from the five deleted lines:
        - the header grew from 110 to 150 bytes, so an envelope packed for the
          old layout is a different length and decodes differently;
        - the salt went from seven fields to ten, so the derived
          `permissionId` changes EVEN WHEN THE THREE NEW FIELDS ARE ZERO.
      MEASURED, not argued. Same seven pre-existing parameters, three new
      fields all zero:
        7-field salt  0x139258924651c0a064b9434660bc2ba3a8733d8c19db5c0a4417683a72df4b12
        10-field salt 0xbb980c8f5d6caa2ff93d279d7c0a5190ad736bedd3087ca571354a725a1b2d27
      Different. So the owner's previously signed authorization no longer
      matches the permissionId the patched validator derives, and the next
      operation on that session fails `InvalidSessionData`. The user must
      re-sign a session authorization. Nothing is lost and no funds move, but
      it is an action the user must take, and it belongs in the ask to ENS and
      in THREAT-MODEL.md. A user with NO live session sees nothing.
      This is the same wall that broke sixteen existing tests during R3; the
      mechanism is identical and it reaches live sessions too.

      PART 3. GAS AND SIZE.
      SIZE, against EIP-170:
        pristine runtime 16,519 bytes
        patched  runtime 18,857 bytes   (+2,338)
        EIP-170 limit    24,576 bytes
        headroom         5,719 bytes, 76.7% of the limit used
      Not near the limit. The rule does not risk an outright refusal, and
      there is room for roughly twice this change again before it would.
      DEPLOYMENT COST: code deposit is 200 gas per runtime byte, so
      +2,338 bytes is +467,600 gas, ONE TIME, paid by whoever deploys the
      validator. No account pays it.
      PER-OPERATION GAS for operations that do NOT touch the renew rule,
      MEASURED by building the pristine tree and running the SAME
      pre-existing suite both ways. All 20 tests in
      `HCAOwnerAndSessionValidator.t.sol`, same test names both runs:
        sum pristine 3,008,757 -> patched 3,071,223, delta +62,466, +2.076%
        per test: +1,841 to +11,309 gas, and ONE test at exactly +0
        (`test_validator_rejectsUnsupportedResolverCall`, 10,322 both ways)
      The +0 is the control: that test does not go through the envelope path,
      so it shows the cost is not a blanket penalty on the contract.
      HONEST LIMIT ON THAT NUMBER, because it is the one place I could
      overstate our case by being sloppy: these are TEST totals, and each test
      packs its own envelope in-test. The delta therefore contains three
      things mixed together - 40 extra proof bytes of calldata and memory,
      three extra words in the salt keccak, and one extra comparison per
      execution in the if-chain. I did NOT isolate the if-chain comparison on
      its own. So "+2% on a pre-existing validator operation" is an upper
      bound that includes work a real caller does off-chain when packing, and
      the true on-chain marginal cost of the new branch is smaller than these
      figures suggest. I would rather hand ENS the upper bound.
      Baseline restored after measuring: `forge test --match-path
      'test/unit/hca/*'` -> 134 passed, 0 failed, and `git status` shows the
      same four modified and two untracked files as before.

      WHAT GOES TO THREAT-MODEL.md SECTION 3, for evidence to write:
        - Existing accounts are unaffected unless their owner upgrades. Two
          consents, DAO-held allowlist role and account owner, plus the
          target's own predecessor gate.
        - On upgrade, a user with NO live session sees no change.
        - On upgrade, a user WITH a live session must re-sign it. Measured
          cause: the 110->150 header and the seven->ten field salt. State
          this loudly; it is the only user-visible regression.
        - Reaching the new code needs the owner's signature over a salt
          committing to a non-zero renew payment token. It cannot be reached
          by a caller who lacks the owner key.
        - +2,338 bytes, 76.7% of EIP-170, 5,719 bytes spare.
        - +467,600 gas once at deployment; up to +2.08% on pre-existing
          validator operations, upper bound, with the mixing caveat above.
- [x] C10. What creates an HCA account, and can the C9 re-signing cost be
      bounded across the live mainnet population?
      Assigned by the operator 2026-10-27, who measured 2861 `HCADeployed`
      events on the mainnet `StandaloneHCAFactory`
      `0x742bf21897a78e2c98cc5f5c5473a370a081e561` over blocks
      26105638 to 26287344.

      2026-10-27: DONE. Q1: creation is EXPLICITLY OPT-IN, and migration does
      not create an HCA. Q2: the affected subset CANNOT be bounded above from
      chain data, and that is a finding, not a gap in the work.

      POPULATION, re-measured independently rather than taken on trust.
      Same topic `0x2f6f28fd05c32050ef9075770f6272930a2c8f0001007bcbac54bbf1084a736b`,
      same factory, blocks 26105638 to 26287353, which is 9 blocks further
      than the operator's run:
        HCADeployed events   2,869
        distinct HCA proxies 2,869   (one event per account, no duplicates)
      The operator's 2,861 at the shorter range and this 2,869 at the longer
      one agree; the eight extra are the nine newer blocks. Neither number is
      rounded. `hca` is the first indexed topic, confirmed against the event
      declaration at `StandaloneHCAFactory.sol` lines 48-53.

      Q1. WHAT CREATES AN HCA. Opt-in, by a direct external call, and nothing
      else.
      `StandaloneHCAFactory.deploy(address owner, address hcaImplementation,
      uint256 userSalt)` is the only creator; it is `external` and it emits
      `HCADeployed` at line 154.
      SEARCHED FOR AN IMPLICIT CALLER AND FOUND NONE: `grep -rn "\.deploy("`
      over the whole of `src/` returns ZERO matches. No contract in the
      repository calls it. So every one of the 2,869 accounts exists because
      something off chain sent that transaction.
      MIGRATION DOES NOT CREATE ONE. `src/migration/MigrationHelper.sol` is
      the only migration file that references the factory at all, and its one
      use is line 109, `_STANDALONE_HCA_FACTORY.authorizedOwnerOf(msg.sender)`
      - a READ that asks "is my caller a certified HCA, and whose?" so the
      helper can attribute a migration an HCA initiated. It never calls
      `deploy`. Neither `LockedMigrationController` nor
      `UnlockedMigrationController` mentions the HCA factory.
      So the answer to "can a user end up with one without choosing it" is NO,
      not as a side effect of migrating a v1 name. An HCA is a deliberate
      account creation. A frontend could of course bundle it into a flow a
      user perceives as one step, and that is a UX question we cannot settle
      from the contracts; what the CONTRACTS show is that no migration path
      creates an account behind the user's back.

      Q2. CAN THE AFFECTED SUBSET BE BOUNDED? Not above. Plainly.
      THE THREE CANDIDATE TRACES, each checked:
      a. `ownerAndSessionNonce`. USELESS for this. `_sessionNonce` is
         documented at `StandaloneSingleOwnerHCA.sol` lines 65-66 as
         "incremented by `revokeSessions`", and the only writer is
         `revokeSessions()` at lines 220-226. A non-zero nonce therefore means
         the owner has REVOKED at least once; it does not mean a session
         exists. Worse for counting, the nonce is ZERO both for an account
         that never had a session and for an account holding a live one. The
         signal is orthogonal to the question.
      b. AN ENABLE EVENT. There is none. `HCAOwnerAndSessionValidator`
         contains ZERO `event` declarations and ZERO `emit` statements,
         measured by grep. The validator is stateless and `view` by design,
         which is why the nine-case matrix could be written as pure checks -
         and the same property means authorizing a session WRITES NOTHING AND
         EMITS NOTHING. A session authorization is an off-chain ECDSA
         signature over a Smart Sessions digest. It exists in the owner's
         wallet or the operator's storage, not on chain.
      c. A USE event. This one exists, and it is the only one. The
         IntentExecutor emits `IntentExecuted(address account, uint256 nonce)`
         (`IStandaloneIntent.sol` line 21, neither parameter indexed).
         MEASURED on mainnet over the same block range, topic
         `0x890728096aa1a0adb39ad882bdff9998ea919a8f490e4d6f2d895566deb39594`:
           IntentExecuted events        3,137
           distinct accounts            1,818
           of those that are HCAs from the set above   354
           executor users that are NOT those HCAs    1,464
         So 354 of the 2,869 HCAs, 12.3%, have ever executed an intent. The
         1,464 others are Rhinestone accounts that are not HCAs; the executor
         is a general module, which is why the raw 1,818 must not be quoted as
         an HCA figure.
      WHY 354 IS STILL NOT THE ANSWER, and this is the honest part:
        - It is an UPPER bound on HCAs that ever used a SESSION, not a count
          of them. `IntentExecuted` does not distinguish an owner-signed
          intent from a session-signed one; both reach the account's ERC-1271
          and both emit the same event. Separating them needs the envelope's
          first byte from each of 3,137 transactions, which I did not do.
        - It says NOTHING about the 2,515 HCAs with no execution trace. Any
          of them may hold a signed, valid, never-yet-used session
          authorization, and no observer can tell.
      CONCLUSION: the subset that would feel the C9 re-signing cost is
      UNCOUNTABLE from chain data. We can say "at most 354 of 2,869 have ever
      run an intent through the executor" and "we cannot determine how many
      hold a live session authorization". We cannot say "only N users are
      affected", and we should not try.

      PARAGRAPH FOR THE PROPOSAL, pasteable:

        There are 2,869 Hierarchical Custody Accounts on Ethereum mainnet,
        measured from `HCADeployed` events on the StandaloneHCAFactory at
        `0x742bf21897a78e2c98cc5f5c5473a370a081e561` between blocks 26,105,638
        and 26,287,353. Every one was created by a direct call to
        `StandaloneHCAFactory.deploy`; no contract in contracts-v2 calls that
        function, and the v1-to-v2 migration path does not create an account,
        so none of these 2,869 exists as a side effect of a migration. This
        change reaches none of them unless their owner upgrades: the account
        holds its own implementation pointer, and an upgrade needs both the
        DAO-held approval role on the upgrade allowlist and a transaction from
        the account owner. An owner who upgrades and holds no session sees no
        change. An owner who upgrades while holding a session authorization
        signed before the change keeps it. That authorization stays valid. The
        owner signs nothing new. The three renew caps are committed inside the
        seven salt fields that already exist, in spare high bits of two words
        the salt already hashes, so a session that does not enable auto-renew
        derives the same permissionId the deployed validator derives today.
        Zero sets no bit. We did not argue this. We reverted the salt change
        in the pre-existing validator test to its form at HEAD `3e54cdb8`, and
        all 134 tests in `test/unit/hca/` still pass against the patched
        validator, including the sixteen that a ten-field salt broke.

        One real cost remains, and it is ours and not the user's. The packed
        session proof header grows from 110 to 150 bytes, to carry the three
        caps on the wire. The owner signs the salt and not the envelope, so an
        existing signature is unaffected. But any software that packs an
        envelope must now emit the longer header. That is a re-packing change
        in operator code. Anything built against the 110-byte layout stops
        working until someone updates it.

        We still cannot tell you how many accounts hold a live session. A
        session authorization is an off-chain signature; the validator is
        stateless and emits no event, so an enabled session leaves no
        on-chain trace. The nearest measurable quantity is that 354 of the
        2,869 accounts have ever executed an intent through the Rhinestone
        IntentExecutor, which is an upper bound on the accounts that have ever
        used a session and not a count of those holding one now. That limit no
        longer bounds a user-visible cost, because there is no longer one. We
        state it because it still bounds what we can claim about who runs
        sessions at all. We would rather state the limit than offer a number
        we cannot support.
- [x] C11. How much smaller can the rule be, without weakening it?
      Assigned by the operator 2026-10-28, who corrected the C9 size figure.
      C9 measured at our `foundry.toml` `optimizer_runs = 200`. ENS deploys at
      `runs = 23000`. Every number below is at 23000.

      2026-10-28: DONE. Answer in one line: the salt CAN hold the three renew
      fields inside the existing seven, it is now shipped, it removes the
      re-signing cost completely, and it COSTS 31 bytes rather than saving
      any. The size objection is NOT solved. Most of the 2,733 bytes is
      policy logic that cannot come out without loosening the rule.

      BASELINE REPRODUCED, both of the operator's numbers, independently:
        pristine post-audit-2   19,753 bytes
        patched (ten-field)     22,486 bytes   +2,733
        EIP-170 limit           24,576 bytes
      Harness `scripts/c11/measure.sh`, which installs a source variant,
      runs `FOUNDRY_OPTIMIZER_RUNS=23000 forge build --skip test --sizes` and
      reads the validator row. NOTE for whoever runs it next: that command
      exits 1 in this tree because the PRE-EXISTING `WrapperRegistry` is over
      EIP-170. That is unrelated to the validator. The harness ignores the
      exit code and fails only when the size row is absent.

      ATTRIBUTION. Built as an additive ladder, so the parts sum to the whole
      exactly rather than approximately. Measured, not read.
        wire: header 110->150, three struct fields, three decode slices  +196
          (L1_salt7 19,949 - pristine 19,753)
        salt: three extra `abi.encode` words                              +55
          (L1 20,004 - L1_salt7 19,949; cross-checked as
           FULL 22,486 - S_salt7 22,431 = 55, the same number twice)
        renew policy check: branch, `_checkRenewCall`,                  +1,644
          `_isAuthorizedRenewer`, lib function, error
          (FULL - S_norenew 20,842)
        money legs: branch, `_checkRenewMoneyCall`, `_checkRenewBatch`    +715
          (FULL - S_nomoney 21,771)
        shared plumbing: `RenewPolicy` struct, the extra parameter        +123
          threaded through `_checkPolicy`, the state struct growth
          (residual: 2,482 - 1,644 - 715)
        TOTAL                                                          +2,733
      Inside the renew policy check, and these three sum exactly:
        `getState` owner read                      +355  (S_noownercheck 22,131)
        `getRenewPrice` + cap compare              +279  (S_nopricecap 22,207)
        `isRenewable` pre-check + its string error  +210  (S_noisrenewable 22,276)
        `_isAuthorizedRenewer` + lib function       +267  (S_noauthcheck 22,219)
        decode of `(RenewData, IERC20)`, the                +533  (residual)
          duration and token equality, branch, state writes
      355 + 279 + 210 = 844 = FULL - S_renewcall_bare 21,642, to the byte, so
      the three external reads share no code.
      Two micro-probes returned almost nothing and were dropped: removing the
      `string label` argument from the error saves 3 bytes (S_errnolabel
      22,483); decoding the struct as a one-tuple and reading the token
      directly saves 12 (S_decode1tuple 22,474).

      THE PRIZE: POSSIBLE, AND SHIPPED. The three renew fields now ride in
      spare high bits of two words the salt already hashed. The field count is
      back to seven.
        word 1  sessionNonce          bits 0-95    renewPaymentToken  bits 96-255
        word 6  maxRefundGasOverhead  bits 0-47    renewalDuration    bits 48-111
                maxRenewSpend         bits 112-207
      LOSSLESS, checked at every type maximum: word 1 fills exactly 256 bits
      and word 6 uses 208 of 256; every field round-trips; no range overlaps.
      So the map from field set to word is a bijection and the salt commits to
      the renew caps exactly as strongly as three separate words did. Nothing
      is weakened.
      BYTE-IDENTICAL when the caps are zero, proved with `cast abi-encode`
      rather than argued: the pristine seven-field encoding and the packed
      encoding with zero caps both hash to
      `0x7856f260a92b146920cb22aa148245aded22a4f59a2efd2f065901caf91d988c`,
      and the encodings compare equal as strings.
      THE PROOF THAT MATTERS, though, is the test tree. With the packed salt
      the salt hunk in the PRE-EXISTING `HCAOwnerAndSessionValidator.t.sol`
      was REVERTED to its HEAD form and all 134 tests still pass. Those are
      the same sixteen tests R3 broke. Their salt code no longer needs to know
      this rule exists. That file's diff fell from 11 insertions and 3
      deletions to 6 insertions and 0 deletions.
      COST: +31 bytes against the ten-field append (22,517 vs 22,486), +86
      against not committing the caps at all. Packing is the DEAREST of the
      three options by size and the only one that keeps the permissionId. The
      shift-and-or arithmetic costs more code than three memory writes.

      CORRECTION TO THE BRIEF, and it makes our position better. The operator
      wrote that the salt is the sole cause of the re-signing cost and C9
      named two causes, the salt and the header. The operator is right about
      RE-SIGNING and C9 conflated two different costs. The owner signs over
      the salt, not over the envelope bytes. So with the salt derivation
      restored, an authorization signed before this rule shipped STAYS VALID;
      the operator software simply packs a 150-byte envelope with three zero
      fields. The header growth is a RE-PACKING cost paid by our own software,
      not a re-signing cost paid by a user. The test tree shows this split
      directly: of the three hunks in the pre-existing validator test, the
      salt hunk could be reverted and the two header-packing hunks could not.
      WHICH DOCUMENTS ARE NOW STALE. Checked on 2026-10-28, not assumed:
      THREAT-MODEL.md does NOT carry the re-signing claim and never did. C9's
      "WHAT GOES TO THREAT-MODEL.md SECTION 3" was a list of material to
      write, and it was never written; `grep -in "upgrade|existing|re-sign"`
      over that file returns one unrelated line. So nothing in THREAT-MODEL.md
      needs correcting. What IS stale is in this ledger: C9 PART 2 CLAIM B,
      C9's fifth THREAT-MODEL bullet, and the C10 pasteable proposal
      paragraph, which tells the reader that an owner holding a session
      "must sign a new one". After this change they do not. The proposal
      paragraph is the one that matters, because it is written to be pasted
      into the ask. FIXED in C12 on 2026-10-28. C9 PART 2 CLAIM B and C9's
      fifth THREAT-MODEL bullet are left as written: they are a dated record
      of what was measured on 2026-10-27 and they were true then. D11
      supersedes them. Do not quote them as current.

      HOW MUCH SMALLER, PLAINLY. Not much, and I will not dress it up.
      One real saving is available and I did NOT take it: dropping the
      `isRenewable` pre-check saves 210 bytes and removes NOTHING that is
      enforced. Read at HEAD `3e54cdb8`,
      `AbstractETHRegistrar.getRenewPrice` (line 109) calls
      `_requireRenewable` (line 156), which runs the SAME
      `_isRenewable(ETH_REGISTRY.getState(LibLabel.id(label)))` predicate as
      `isRenewable` (line 88) and reverts `NameNotRenewable`. Same contract,
      same predicate, same block. Any label our pre-check refuses, the price
      call refuses too. Only the surfaced error changes, from our
      `RenewalTargetNotRenewable(label)` to the registrar's
      `NameNotRenewable(label)`.
      NOT TAKEN because it is the operator's call, not mine: it reverses
      decision D7 and it breaks T9, which asserts our error by selector. The
      brief's hard constraint is that all ten tests keep passing, so taking it
      needs D7 reversed first. If taken: 22,307 bytes, 2,269 spare.
      Everything else measured is a policy check. The role check (267), the
      owner read (355), the price and cap (279) and the money-leg exactness
      (715) cannot come out without loosening the rule. The wire (196) carries
      the caps and the salt (55) commits them; neither is removable.
      So the floor, as the rule stands, is about where it already is.

      WHAT I DID NOT MEASURE, and it is the option worth measuring next. If
      headroom is the real objection, shaving bytes is the wrong lever; moving
      them is the right one. The renew policy logic is 2,482 of the 2,733
      bytes and it is self-contained. An EXTERNAL library, delegatecall-linked
      rather than the inlined `internal` style of `HCARegistrarPolicyLib`,
      would move most of it out of the validator's own runtime and answer the
      headroom objection outright. I did not build it: external library
      functions take memory structs by copy and cannot mutate
      `RegistrationPolicyState` in place, so the batch state would have to be
      returned and reassigned, which is a real refactor with its own clarity
      cost. UNMEASURED. Do not quote a number for it.

      WHERE THIS LEAVES THE ASK. 22,517 bytes, 91.6% of EIP-170, 2,059 spare.
      PR 473 costs +544 and ours costs +2,764. We are still five times their
      size and that objection stands unanswered. What changed today is the
      OTHER objection: no existing user has to re-sign anything.

      VERIFIED: `forge test --match-path 'test/unit/hca/*'` -> 134 passed,
      0 failed, which is the C9 baseline; the ten AutoRenewPolicy cases inside
      it all pass; `bun test operator/session.vector.test.ts` -> 9 passed,
      0 failed, after `scripts/dump-vector.sh` regenerated the golden vector,
      which that script's own header says to do whenever the packing changes.
      Before regenerating, the vector test FAILED on 4 cases and diverged at
      exactly the permissionId bytes, which confirms it is load-bearing for
      this change rather than passing by luck.
      CAVEAT, my own error, recorded because it cost real diff noise: I ran
      `forge fmt` on the validator and it reformatted the whole file, because
      the committed ENS source is itself NOT `forge fmt` clean under this
      foundry.toml. Pristine HEAD fails `forge fmt --check` too. The churn was
      undone by rebuilding the file from the pre-format copy and re-applying
      the edit by hand. DO NOT run `forge fmt` on a tracked file in this
      clone. The untracked `AutoRenewPolicy.t.sol` was reformatted by that
      same run and was not restored; it is ours and untracked, so no diff
      against ENS is affected, but its layout is no longer the author's.

      2026-10-28, later beat: TWO ERRORS OF MY OWN, found and fixed.
      1. DECISION NUMBER COLLISION. I wrote the packing decision as "D9".
         DECISIONS.md already had D9 ("Default values for D4's two caps") and
         D10. My check had grepped for `^## D7|^## D8` only and never listed
         the headings, so it missed both. Renumbered to D11 and fixed the one
         reference, the `_sessionAuthorizationSalt` doc comment in the
         validator. DECISIONS.md now has exactly one D9, one D10, one D11.
      2. AN UNVERIFIED CLAIM. The first C11 note said THREAT-MODEL.md section
         3 tells users they must re-sign and needs correcting. It does not say
         that and never did; I asserted it from C9's "what goes to
         THREAT-MODEL" list without opening the file. Corrected above. The
         stale text is in this ledger, not in THREAT-MODEL.md.
      Verified after both edits: `forge test --match-path 'test/unit/hca/*'`
      -> 134 passed, 0 failed; validator runtime 22,517 bytes at
      FOUNDRY_OPTIMIZER_RUNS=23000, unchanged, as expected for a comment edit.
- [x] C12. Take the 210 bytes, and correct the C10 proposal paragraph.
      Assigned by the operator 2026-10-28. Both are operator decisions, not
      mine: the operator authorised reversing DECISIONS.md D7 and changing
      test T9, and accepted the C11 evidence for the saving.

      2026-10-28: DONE. Both tasks complete and verified.

      TASK ONE. THE 210 BYTES ARE TAKEN.
      Removed from `_checkRenewCall`: the `isRenewable` pre-call and its
      revert. Deleted: `error RenewalTargetNotRenewable(string label)`,
      selector `0x0c8b8bba`. Checked before deleting that nothing else
      referenced it. Three references existed and all three were handled:
        src   `HCAOwnerAndSessionValidator.sol` 212 (declaration) and 1008
              (the revert), both removed;
        test  `AutoRenewPolicy.t.sol` 590 (T9's assertion), now the
              registrar's error;
        TS    `operator/session.ts` 457, a comment only, reworded.
      The generated ABI and artifact files under `contracts/generated/` also
      carry the selector. They are build output and regenerate; they were not
      hand-edited.
      SIZE at `FOUNDRY_OPTIMIZER_RUNS=23000`:
        before C12  22,517 bytes   2,059 spare   91.6% of EIP-170
        after  C12  22,307 bytes   2,269 spare   90.8% of EIP-170
      The saving is 210 bytes, exactly the C11 prediction. The rule now costs
      +2,554 against pristine 19,753.
      T9 KEPT, not deleted. It now asserts
      `IETHRenewer.NameNotRenewable.selector` with `LABEL`, in place of our
      own error. The behaviour under test is unchanged: `ETHRenewerV1` passes
      the authority check because it holds `ROLE_RENEW`, and it still refuses
      to renew a native v2 name. Only the error that surfaces changed. The
      test's comment block now records the reversal and why the case survives
      it, so a reader does not have to find C12 to understand the assertion.
      The two `setUp` assertions at lines 182-183, which read `isRenewable`
      off both registrars directly, were KEPT. They are what proves the
      fixture is actually exercising a non-renewable target, and they now
      carry more weight than before, because the validator no longer asks that
      question itself.
      D7 UPDATED IN PLACE. Point 3 of the decision is struck through and
      marked reversed, so a reader of the decision cannot miss it, and a new
      "Reversal of point 3" section carries the date, the reason, the measured
      saving, and the cost. The consequence line that named the dead error was
      corrected too.
      THE COST, written down rather than left implicit, as instructed: we no
      longer own that check. We depend on `getRenewPrice` continuing to call
      `_requireRenewable`. If ENS ever changed `getRenewPrice` to price a name
      without testing renewability, our rule would silently stop checking
      renewability, and nothing would fail loudly. T9 would still pass,
      because it now asserts the registrar's error and the registrar would
      simply stop raising it. BLAST RADIUS, bounded and stated: a renewal of a
      non-renewable name still cannot move value to an attacker, because the
      money legs still require an exact match to the quoted price, the target
      must still hold `ROLE_RENEW`, and the name must still bind to the owner.
      The failure mode is a wasted transaction paid by the owner against a
      name that cannot be extended. It is a diagnostics and gas-waste
      regression, not a security hole.

      TASK TWO. THE C10 PROPOSAL PARAGRAPH IS CORRECTED.
      Rewritten above, in place, at the end of C10. What changed: the sentence
      telling an owner with a live session that they must sign a new
      authorization is gone, because after D11 they do not. What replaced it
      states the opposite and says why, and points at the evidence that it is
      not an argument: the salt hunk in the pre-existing validator test was
      reverted to HEAD `3e54cdb8` and all 134 tests still pass.
      KEPT, because all of it is still true and still measured: the 2,869
      accounts with their factory address and block range; the opt-in finding
      and the fact that migration creates no account; the two consents needed
      to upgrade; and the statement that the affected population cannot be
      counted, with the 354 figure and its upper-bound caveat.
      NOT SOFTENED. The paragraph now carries a cost the old one did not state
      at all: the 110 to 150 byte header growth is real, it is a re-packing
      change in operator code, and anything built against the 110-byte layout
      stops working until someone updates it. The old paragraph mislabelled
      that as a user re-signing cost. It is not a user cost, but it is not
      nothing either, and it is now named as ours.
      The uncountability statement was re-framed rather than dropped. It no
      longer bounds a user-visible cost, because there is none. It still
      bounds what we can claim about who runs sessions at all, and the
      paragraph says exactly that.

      VERIFIED, after both tasks, at `FOUNDRY_OPTIMIZER_RUNS=23000`:
        `forge test --match-path 'test/unit/hca/*'`  134 passed, 0 failed
        the ten AutoRenewPolicy cases inside it      all pass, T9 included
        `bun test operator/session.vector.test.ts`   9 passed, 0 failed
      The vector needed NO regeneration this time, and that is the expected
      result rather than luck: C12 removed a policy call and an error. It
      touched neither the salt nor the header, so the envelope bytes and the
      permissionId are unchanged.
      `forge fmt` WAS NOT RUN on anything. Every edit was applied by hand
      through an exact-match replacement that asserts it matched once.
