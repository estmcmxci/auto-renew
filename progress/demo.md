# demo — progress ledger

One beat does ONE unchecked item, then stops.
Items marked GATED must wait until progress/contracts.md C1 is checked.

- [x] D1. Read PRD.md, ERD.md section 8, DEMO-SCRIPT.md, DECISIONS.md D2/D3.
      2026-10-22: Read all four. Verified: PRD defines the two-pane/two-control
      demo and the setup flow (two signatures, no transaction); ERD §8 pins the
      frontend stack (Vite/React/wagmi/viem/Thorin, viem >=2.35.0) and the two
      panes' exact fields; DEMO-SCRIPT.md gives the six-beat sequence and bans
      any log line not produced by a contract event or call result;
      DECISIONS.md D2 confirms the stack choice and D3 confirms Node for the
      local fork, a Cloudflare Worker on cron for Sepolia, sharing one
      TypeScript operator core. No blockers found for D2 onward.
- [x] D2. Scaffold Vite + React + TypeScript in /Users/oakgroup/auto-renew/app.
      2026-10-22: Ran `npm create vite@latest -- --template react-ts` in a
      scratch temp dir, then merged the output into app/, preserving the
      pre-existing app/.env.example (vite's template does not generate one,
      so there was no conflict). Renamed package.json name to
      "auto-renew-app". Verified: `npm install` (27 packages, 0
      vulnerabilities), `npx tsc -b --noEmit` clean, `npm run build`
      succeeds (dist/ produced then removed — dist/ and node_modules/ are
      already in app/.gitignore from the scaffold). Node v24.1.0, npm
      11.7.0, vite 8.3.5, typescript ~6.0.3, react 19.3.1.
- [x] D3. Add wagmi, viem pinned >= 2.35.0, and @ensdomains/thorin.
      DECIDED 2026-10-22 by the owner: PIN REACT TO 18. Set react and
      react-dom to ^18.3.1 and @types/react, @types/react-dom to their v18
      lines, then install Thorin normally. Do NOT use --legacy-peer-deps and
      do NOT drop Thorin. The demo needs nothing from React 19, and Thorin
      looking authentic is half the argument of the left pane.
      You are unblocked. Proceed.
      2026-10-22: DONE. Edited `app/package.json`: react and react-dom to
      `^18.3.1`, `@types/react` to `^18.3.31`, `@types/react-dom` to
      `^18.3.7` (both current npm-registry heads of the v18 line, checked
      with `npm view`). Ran `npm install` to resolve node_modules against
      the new pins — clean, no ERESOLVE, 0 vulnerabilities.
      Re-checked the two Thorin tags against React 18 before installing,
      since the earlier blocks found `latest` (0.6.50) needs react `^17`
      and only `next` (1.0.0-beta.28) needs react `^18`: confirmed with
      `npm view @ensdomains/thorin@1.0.0-beta.28 peerDependencies` (react
      `^18`, react-dom `^18`, nothing else required — no styled-components
      peer on this line). Installed that exact version,
      `@ensdomains/thorin@1.0.0-beta.28`, not the moving `next` tag.
      `npm install @ensdomains/thorin@1.0.0-beta.28 --dry-run` was clean
      first; the real install added 16 packages, no ERESOLVE, no
      `--legacy-peer-deps`, 0 vulnerabilities. npm wrote the dependency as
      `^1.0.0-beta.28` (its own default save-prefix) — left as npm wrote it,
      since the instruction said install normally, not pin exactly.
      Verified after install: `npx tsc -b --noEmit` clean, `npm run build`
      succeeds (dist/ produced then removed, same as D2), `npm audit
      --omit=dev` 0 vulnerabilities. Did not render a Thorin component yet —
      that is D6, not this item. wagmi 3.7.9 and viem 2.57.10 from the
      earlier (blocked) attempt were already installed and untouched by
      this change.
      2026-10-22: BLOCKED on @ensdomains/thorin. Installed wagmi 3.7.9 and
      viem 2.57.10 (both saved with an exact pin, no caret; viem is above the
      2.35.0 floor). npm auto-installed wagmi's required peer
      @tanstack/react-query (^5.104.5, not optional per wagmi's
      peerDependenciesMeta). Verified: `npx tsc -b --noEmit` clean, `npm run
      build` succeeds, 0 vulnerabilities, no ERESOLVE warnings. Checked npm
      registry for @ensdomains/thorin (no install attempted): the `latest`
      tag (0.6.50) peer-requires react ^17 / react-dom ^17 (styled-components
      v5 era); the `next` tag (1.0.0-beta.28) peer-requires react ^18 /
      react-dom ^18 (vanilla-extract era). app/package.json pins react
      ^19.3.1 / react-dom ^19.3.1 from the D2 scaffold (current create-vite
      react-ts default). No published Thorin release declares support for
      React 19. DECISIONS.md D2 requires Thorin so the left pane "read[s] as
      the shipped feature, not as an approximation," and does not anticipate
      this conflict. Did not force-install with --legacy-peer-deps or
      downgrade React: unverified whether either Thorin release actually
      breaks at runtime under React 19, and this file's rule against
      rounding up an unverified claim applies as much to a dependency
      install as to a contract finding.
      2026-10-22: BLOCKED. `app/package.json` (from D2) carries
      react@^19.3.1 and react-dom@^19.3.1 — the current Vite react-ts
      template default. `@ensdomains/thorin` has no release that accepts
      React 19 as a peer:
        - `@ensdomains/thorin@0.6.50` (npm dist-tag `latest`) peer-depends
          on `react@^17`, `react-dom@^17`, `styled-components@^5.3.3`,
          `react-transition-state@^1.1.4`.
        - `@ensdomains/thorin@1.0.0-beta.28` (npm dist-tag `next`) peer-
          depends on `react@^18`, `react-dom@^18`.
      Confirmed by running the real install, not just reading peerDependencies:
      `npm install wagmi viem@2.57.10 @ensdomains/thorin --dry-run` inside
      `app/` fails with `ERESOLVE` against both tags (full npm output kept
      in this beat's transcript; logs at
      `~/.npm/_logs/2026-10-22T18_34_05_126Z-eresolve-report.txt` and
      `..._18_34_10_205Z-eresolve-report.txt`). wagmi@3.7.9 and
      viem@2.57.10 have no such conflict (wagmi peer-requires
      `react>=18`, satisfied by 19.3.1; viem has no React peer at all) —
      only Thorin blocks.
      Did not run with `--force` or `--legacy-peer-deps`: npm's own
      message calls that resolution "potentially broken," and DECISIONS.md
      D2's reason for choosing Thorin is that the left pane must "read as
      the shipped feature" — a forced install risks exactly the silent
      visual/behavioral breakage that reason exists to avoid. Did not
      install wagmi+viem alone and leave Thorin out, to avoid a half-wired
      D3.
      This is a decision outside this item's scope (it reopens D2's
      stack pin, not just D3's package list). Options for whoever decides:
      pin `react`/`react-dom` to `^17` or `^18` in `app/package.json` to
      match a Thorin line, or accept `--legacy-peer-deps` with Thorin
      0.6.50 (React 17 peer) and verify manually it renders correctly
      under React 19, or wait on Thorin for a React 19-compatible release.
      Unverified: whether Thorin 0.6.50 or 1.0.0-beta.28 actually break at
      runtime under React 19 — only the peer-dependency metadata was
      checked, not actual rendering.
      2026-10-22: Re-checked before this beat acted: `npm view
      @ensdomains/thorin dist-tags` still shows `latest` 0.6.50 / `next`
      1.0.0-beta.28, same two tags as before, no new release. `app/package.json`
      still pins react/react-dom ^19.3.1 from D2. Nothing has changed since
      the prior block; still waiting on a D2 decision (pin react down, or
      accept --legacy-peer-deps with manual runtime verification, or wait
      on Thorin). Not re-running the install attempt since the versions are
      unchanged. Still blocked, same reason.
- [x] D4. Create app/.env from app/.env.example. No secrets, ever.
      2026-10-22: DONE. Copied `app/.env.example` to `app/.env` byte-for-byte
      (`diff` confirms identical) — every value in the example is already
      public (chain id, localhost RPC URLs, a blank demo-name placeholder),
      so a verbatim copy carries nothing that needs stripping. Left
      `VITE_DEMO_NAME` blank: no demo name is decided anywhere in the repo
      yet (checked `.env`, `STATE.md`, `config/networks.ts` — none name one),
      so filling it in would be inventing a value, not reading one. Verified
      gitignored: root `.gitignore` lines 2-3 (`.env`, `.env.*`) match
      `app/.env` with no leading slash, so it applies at any depth; `git
      status` was not run to avoid touching anything outside this item, the
      pattern match is sufficient.
      Flagging, not fixing: `VITE_RPC_URL=http://127.0.0.1:8545` here matches
      the example and `ERD.md` line 214, but `progress/contracts.md` S2
      found the Sepolia fork actually runs on **8546** (8545 is held by an
      unrelated, unkillable anvil process). S2 left that mismatch for
      "the frontend work" to resolve and D4 is a verbatim-copy item, not a
      config-repair item, so it is carried forward to D5 (`config/networks.ts`
      and `preflight.ts`, which is where "fail loudly on an unknown chain id"
      / a dead RPC would actually surface it) rather than silently reconciled
      here.
- [x] D5. Wire config/networks.ts and preflight.ts. Fail loudly on an unknown
      chain id. Never hardcode an address.
      2026-10-22: DONE, scoped narrowly. Both files already existed at
      `config/networks.ts` and `config/preflight.ts` (contracts-track work);
      this item wires them into `app/`, it does not create them. Added
      `app/src/lib/network.ts`: reads `VITE_CHAIN_ID` from `import.meta.env`,
      throws if it is missing or not an integer, then calls `getNetwork()`
      from `config/networks.ts` — which throws its own error naming the
      known chain ids if the id has no entry. That is the "fail loudly"
      path; there is no fallback network and no default chain id anywhere
      in the new file. Re-exports `preflight`, `assertPreflight`,
      `needsVerification` and the `Reader`/`PreflightResult` types from
      `config/preflight.ts`, so the rest of `app/src` has one import path
      for both config modules instead of reaching past `app/` with a
      relative `../../../config/...` path more than once. `network` (the
      resolved `NetworkConfig`) is the only way anything in `src` may reach
      an address — no file under `src` may import `config/networks.ts`
      directly or write a literal `0x...`.
      Did NOT wire a concrete viem `Reader` (the interface `preflight.ts`
      needs to actually run against a chain) or call `preflight()`/
      `assertPreflight()` anywhere yet. That needs a live RPC connection,
      and `config/README.md` says preflight "must pass before anything else
      runs" — deciding what runs it and when belongs with D7 (operator
      core, which needs the same kind of RPC reader) or D6/D10 (the pane
      that would show the result), not with this item, which is about making
      the two modules reachable and the chain-id guard live.
      Verified: `npx tsc -b --noEmit` clean, `npm run build` clean (dist/
      produced then removed). Not verified by execution: the actual throw
      paths (missing/non-numeric `VITE_CHAIN_ID`, and an unrecognized chain
      id) were checked by reading the code, not by running it, since nothing
      in `src` imports `network.ts` yet (D6 wires the first consumer) and
      there is no test harness in `app/` to exercise it standalone. Marking
      this unverified rather than rounding up: `readChainId()`'s guard
      (`!raw || !Number.isInteger(chainId)`) and `getNetwork()`'s lookup
      (pre-existing code, a plain object-key check with a throw) read as
      correct, but were not executed against a bad value.
- [x] D6. GATED on progress/contracts.md C1. Build the two-pane static shell
      per DEMO-SCRIPT.md. Left pane in Thorin. Right pane empty, with its
      columns.
      LEDGER CORRECTED 2026-10-22: you were right. D6 is ERD section 9
      step 3 and AGENTS.md hard rule 5 forbids it before step 1 passes.
      The gate was missing from this item; it is now explicit. Skip D6
      per the HEARTBEAT rule for gated items and continue to D7, which is
      step 2 (the operator process) and is not gated.
      2026-10-22: BLOCKED, not done. This item is not marked GATED in this
      file, but it is gated anyway, by a rule the ledger does not mention.
      `AGENTS.md` hard rule 5: "Do not start the frontend before the test
      matrix passes. Section 9 of ERD.md gives the build order. Step 1 is
      the entire contested claim." `ERD.md` section 9 names the steps and
      is explicit: step 2 is "Stand up the local fork and the operator
      process," step 3 is "Build the two panes against the operator log,"
      and the line directly under the list reads "Step 1 is the whole
      contested claim. Do not start step 3 before step 1 passes." D6 —
      building the two panes — is step 3, word for word. Step 1 is the nine
      tests on the Sepolia fork, tracked as `progress/contracts.md` T1-T9
      and closed out at C1. `progress/contracts.md` right now: R2 is
      BLOCKED (an operator decision is open, see that file), R3 and R4 are
      unchecked, none of T1-T9 are checked, and C1 is unchecked. Step 1 has
      not passed.
      Not treating this as the same thing as the D10-D13 GATED items: those
      name `progress/contracts.md` C1 explicitly as their gate; D6 names no
      gate at all, so without this note a beat would read D6 as free to do
      now. It is not. Per this file's rule for a blocked item, not
      improvising a different task in its place: D7, D8 and D9 are step-2
      work (operator core and its two entry points) and read as ungated by
      the same AGENTS.md rule, since ERD section 9 only names step 3 as
      waiting on step 1 — but this beat stops at the first unchecked item
      and reports it, rather than deciding that call unilaterally and
      skipping ahead.
      2026-10-22: GATE MET, DONE. `progress/contracts.md` C1 is checked —
      all nine tests passed in one run (forge output pasted there) — so
      step 1 has passed and this item is unblocked, per the manager's
      correction above.
      Built the static shell per `ERD.md` 8.1/8.2 and `DEMO-SCRIPT.md`'s
      Setting section:
      - `app/src/components/LeftPane.tsx`: the eight ERD 8.1 fields (name,
        expiry, countdown, auto-renew switch, funding source, balance,
        fallback address, status line), in a Thorin `Card`, using
        `Heading`, `Typography`, `Tag` and `Checkbox` — all from
        `@ensdomains/thorin`, satisfying "Left pane in Thorin" and
        DECISIONS.md D2's reason (read as the shipped feature). A `<dl>` of
        label/value pairs, each value a literal "—": no file under `D6`
        reads a contract yet (D7's core exists but nothing calls it from
        `src/` until D10), so a real value here would be invented, not
        read — AGENTS.md's "do not round up" applies to a placeholder UI
        value the same as a written claim.
      - `app/src/components/RightPane.tsx`: plain semantic HTML, not
        Thorin — ERD 8.1 asks for the design system on the product pane
        specifically, and this is "the proof," a different pane with a
        different job. A `<dl>` for session key / session expiry / duration
        cap / spend cap / budget remaining (ERD 8.2's "session key and
        session expiry, both caps, budget remaining"), then a `<table>`
        with four `<th scope="col">` columns (Result, Action, Detail,
        Reason) and a **literally empty** `<tbody>` — "Right pane empty,
        with its columns," exactly as the item asks, and AGENTS.md hard
        rule 4 ("Never write a log entry in the demo frontend from frontend
        state") enforced by construction: there is no code path in this
        file that can produce a row, since D10 (still the only item that
        wires real events) hasn't run.
      - `app/src/App.tsx`: wraps both panes in Thorin's `ThemeProvider`,
        imports `@ensdomains/thorin/dist/thorin.css`. Replaced the D2
        scaffold placeholder content entirely; deleted the three now-unused
        scaffold assets (`hero.png`, `react.svg`, `vite.svg`) after
        confirming nothing still imported them. Fixed `index.html`'s
        `<title>`, still the scaffold's "auto-renew-vite-scaffold".
      - `app/src/App.css`: a two-column CSS grid for `.demo-layout`
        (`.pane-right` bordered to read as a distinct surface from the
        Thorin `Card` on the left), collapsing to one column under 640px;
        removed every rule left over from the Vite template's hero/
        next-steps sections, none of which this shell uses.
      FOUND AND WORKED AROUND, not left silently broken: Thorin's `Toggle`
      and `Checkbox` render with a **fully transparent** track, knob and
      border under this setup. Verified in a real browser (Playwright),
      not assumed:
      - `Toggle`, disabled, default color: `background-color:
        rgba(0,0,0,0)` on both the input and its `::after` knob,
        `background-image: none`, `border: 0px none`.
      - `Toggle` again, enabled (`checked`, `readOnly`, no `disabled`) with
        an explicit `color="blue"`: identical, still fully transparent. So
        not a disabled-state style choice and not a missing-prop issue.
      - `Checkbox` (a different component): same result, fully invisible.
      - `Box`, `Typography`, `Card`, `Heading`, `Tag` all render correctly
        (the Card border, the grey "Not configured" tag, the heading font
        are all visible in the screenshot) — so `thorin.css` itself loads
        and most of the package works. The break is specific to these two
        "recipe"-based (`RuntimeFn` from `@vanilla-extract/recipes`) form
        controls.
      Root cause, as far as verified without reading Thorin's own build
      pipeline: the package's global reset (`* { appearance: none;
      background: none }`, confirmed present in `dist/thorin.css`) strips
      the native checkbox box, and the vanilla-extract recipe classes meant
      to restore a visible fill never take effect when a consumer only
      imports the prebuilt `dist/thorin.css`, as this app does, rather than
      running Thorin's own vanilla-extract compilation step — a build-
      pipeline gap, not a code mistake in this app. Unverified: whether
      this is a known, filed issue upstream, or specific to the
      `1.0.0-beta.28` release; not checked, out of scope for a progress
      note.
      This is exactly the kind of thing D3's original block flagged as
      unverified ("whether Thorin ... actually breaks at runtime ... only
      the peer-dependency metadata was checked, not actual rendering") —
      now checked, and it does break, for these two components, under
      React 18 (the owner's D3 decision), not for the React-19 reason D3
      worried about.
      Fix applied, scoped to this one control: `.thorin-checkbox-visible-
      fix { appearance: auto }` in `App.css`, restoring the browser's native
      checkbox rendering on the `auto-renew` control only. Commented in
      place with the full reasoning above, so it reads as a documented
      workaround, not an unexplained override. Did not attempt to patch
      Thorin's own CSS or fork the package: out of scope for a shell item,
      and the native fallback is functionally and visually sufficient for
      a disabled/read-only placeholder control.
      Verified by execution:
      - `npx tsc -b --noEmit` and `npm run build` both clean (dist/
        produced then removed).
      - Real browser (Playwright/Chromium): navigated, took an accessibility
        snapshot (correct heading levels h1→h2→h3, `<dl>`/`<dt>`/`<dd>`
        structure, table with four columnheaders and an empty rowgroup, the
        checkbox exposed with accessible name "Auto-renew" and `[disabled]`
        semantics removed once switched off `readOnly`-only — confirmed the
        label association resolves correctly either way), full-page
        screenshot at the default viewport, a second screenshot at 320px
        width (stacks to one column, nothing clipped or overlapping), and
        console messages checked after a fresh navigation: 0 errors, 0
        warnings. (Mid-edit, swapping `Toggle` for `Checkbox`, a transient
        "Toggle is not defined" HMR error appeared in the console's full
        history — confirmed stale by re-checking after a fresh navigation,
        not present in the final state; noting this so the zero-error claim
        reads as checked, not assumed.)
      - Confirmed no dev server or stray process left running afterward
        (`pgrep`).
      Not done here, left for later items: any real data (D10, gated no
      longer but a separate task), the controls section (time scrubber,
      drain button — D11/D12), and the setup flow (D13).
- [x] D7. Operator shared TypeScript core: read expiry, decide the window.
      Use the *_READ_RPC_URL, not the fork URL.
      2026-10-22: DONE. New file `operator/core.ts`, a new top-level
      directory beside `app/` and `config/`, per DECISIONS.md D3 / STATE.md
      D3 ("shared TypeScript core... thin entry point" for each runtime).
      Holds no RPC client, no key, no clock — D8 and D9 (the two entry
      points) supply those.
      - `readExpiry(reader, name)`: calls `reader.findExpiry(label)`, the
        `ITemporalRegistry.findExpiry(string)(uint64)` view call
        (`contracts-v2/contracts/src/registry/PermissionedRegistry.sol:307`,
        implemented on `ETHRegistry`). Takes a `label` only (e.g.
        "estmcmxci", not "estmcmxci.eth").
      - `decideWindow(expiry, now, windowSeconds?)`: pure, takes both times
        as arguments instead of reading a clock, so no Reader is needed to
        test it. Returns `insideWindow` and `expired`.
      "Use the *_READ_RPC_URL, not the fork URL": read as an instruction for
      verifying *this item*, not a runtime rule for every future caller —
      written into the file as a doc comment on `ExpiryReader`, with the one
      exception spelled out: the local-fork entry point (D8) necessarily
      reads the fork's own RPC, because the fork is what carries the warped
      clock the demo scrubs; reading `SEPOLIA_READ_RPC_URL` there would read
      the real, un-warped chain instead. That is D8's call to make, not
      bound here.
      Flagging, not deciding: `DEFAULT_TRIGGER_WINDOW_SECONDS` (30 days) is
      a placeholder. No document gives the trigger window a number — ERD.md
      7.2 and DEMO-SCRIPT.md beat 2 both name the concept with no seconds
      value, and it is not on STATE.md's "Open decisions" list (that list
      only names the two contract-level caps). Picked 30 days only so
      `decideWindow` has a default, same order of magnitude as the 28-day
      post-expiry grace period. Said so in the file; do not cite it as
      decided. Confirm or replace once D8 exists and its pacing can be
      checked against the fork's scrubber.
      Verified by execution, not just by reading the code:
      - Ad hoc typecheck, no project config needed (pure interfaces/consts):
        `app/node_modules/.bin/tsc --noEmit --strict --target es2023
        --module esnext --moduleResolution bundler operator/core.ts` — clean.
      - `decideWindow` boundary behavior, run with Node 24's native TS
        support (`node -e` importing the file directly): 60 days out ->
        outside; 10 days out -> inside; exactly 30 days out -> inside (the
        boundary is `<=`); 30 days + 1 second out -> outside; 5 days past
        expiry -> inside and expired; exactly at expiry -> inside and
        expired. All six matched expectation.
      - `readExpiry` against the real chain: `cast call` against
        `config/networks.ts` sepolia `ETHRegistry`
        (`0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4`) with
        `findExpiry(string)(uint64)` on label `"estmcmxci"`, over
        `$SEPOLIA_READ_RPC_URL` (sourced from `.env`, never echoed; the
        racer, not the dedicated fork endpoint) — returned `1799515980`, a
        real forward-dated expiry, so that label is registered on this
        ENSv2 deployment. Then wrote a scratch script (viem
        `createPublicClient` + `readContract`, same address, same
        signature) calling this file's actual exported `readExpiry`, ran it
        the same way, got the identical `1799515980n`, and deleted the
        script after — it was not kept, this item produces no `app/`
        artifact.
      Not done here, left for later items: building and submitting the
      renewal call, writing the fallback address on a funding failure, and
      recording the attempt (ERD.md 7.2 steps 3-5) — those need the
      contract change, still behind `progress/contracts.md` C1, same gate
      as D6.
- [x] D8. Node entry point for the local fork.
      2026-10-22: DONE. New file `operator/node.ts`, the thin runtime D7's
      core.ts was written for (DECISIONS.md D3). Same scope as D7: read
      expiry, decide the window, log the result — no signing, no
      submission, no fallback write (ERD.md 7.2 steps 3-5, still behind
      `progress/contracts.md` C1).
      Needed a real package to run in, since nothing at the project root
      could resolve `viem` before this: added root `package.json`
      ("auto-renew-operator", scoped to `operator/` and `config/`, not the
      frontend) with `viem` pinned `2.57.10` (same exact version as `app/`)
      and `typescript`/`@types/node` matching `app/`'s versions, and root
      `tsconfig.json` (bundler resolution, matching `app/tsconfig.app.json`
      — `nodenext` resolution was tried first and rejected: it fought the
      `.ts`-extension imports this file needs to run directly under Node's
      native TS support, the same execution model D7 verified `core.ts`
      with). `npm install` clean, 0 vulnerabilities. `node_modules/` already
      covered by the root `.gitignore`.
      Fixed, not just flagged, the port mismatch D4 and D7 both carried
      forward: `.env`'s `LOCAL_RPC_URL` said `8545`, matching `ERD.md` line
      228, but `progress/contracts.md` S2 found the project's actual fork on
      **8546** (8545 held by an unrelated anvil, pid 89631, no ENSv2 code).
      Re-confirmed both still true right now with `lsof` and `cast
      chain-id`/`cast code` against `:8546` before relying on it, per
      `AGENTS.md`'s "verify against deployed contracts, never a local ABI."
      Changed `.env`'s `LOCAL_RPC_URL` to `8546` and `ERD.md` line 228 to
      match (did not touch the unrelated anvil on 8545 — not this project's
      process, same restraint S2 took). `app/.env`'s `VITE_RPC_URL` is the
      same bug and is NOT fixed: that file feeds the frontend, which stays
      gated behind D6/C1, so it is left for whoever does D6 to fix with the
      fork state current at that time, not fixed speculatively now.
      Added `WATCHED_LABELS` (comma-separated labels the operator watches)
      to `.env` and `.env.example`: nothing let this entry point run
      without one, and no demo name is decided (D4). Left `.env.example`'s
      copy blank, filled `.env`'s with `estmcmxci` — already registered on
      this ENSv2 deployment, confirmed by D7's `readExpiry` check — with a
      comment that this is for exercising the entry point, not a claim that
      it is the chosen demo name.
      Verified by execution: `tsc -p tsconfig.json` clean (no `strict: true`
      — tried it first, it surfaced an unrelated type complaint in
      `config/preflight.ts` that app's own working, non-strict config
      doesn't hit; not this item's file to fix, so matched `app/`'s
      strictness instead of carrying a stricter setting into code I do not
      own). Ran the entry point against the live fork at `:8546`
      (`POLL_INTERVAL_MS=1500 node --env-file=.env operator/node.ts`, in the
      background, killed with `pkill` after ~5s): logged "connected to
      sepolia (chain 11155111) via http://127.0.0.1:8546", then four
      identical ticks reading `estmcmxci` expiry as 2027-01-09T17:33:00Z
      (matches the raw `1799515980` from D7, so the fork and real Sepolia
      agree, as ERD.md 6.2 says they should) with `insideWindow=false,
      expired=false` (~79 days out, outside the 30-day placeholder window —
      correct). Confirmed with `pgrep` afterward that no process was left
      running. Did not verify the chain-id guard's failure path (pointing
      `LOCAL_RPC_URL` at the unrelated anvil on 8545, which has a different
      or unknown chain id) by actually running it that way — read as
      correct by the same reasoning as D5's `getNetwork` guard, not
      executed against the bad case; marking unverified rather than
      rounding up.
      Not done here: `operator/worker.ts` (D9) and publishing the attempt
      log over HTTP at `VITE_OPERATOR_URL` (`app/.env.example`, consumed by
      the GATED D10). Nothing reads that endpoint before D10, so building it
      now would be unverifiable against a real consumer; left for D10 or
      whichever item first needs it.
- [x] D9. Cloudflare Worker entry point on cron for Sepolia. Same core.
      2026-10-22: DONE. New files `operator/worker.ts` and
      `operator/wrangler.jsonc`, the Sepolia twin of D8's `operator/node.ts`
      (DECISIONS.md D3), from the same `operator/core.ts` (D7). Same scope
      as D7/D8: read expiry, decide the window, log the result — no
      signing, submission or fallback write (ERD.md 7.2 steps 3-5, still
      behind `progress/contracts.md` C1).
      Loaded the `cloudflare:wrangler` skill before writing config, since
      this project's Wrangler knowledge could be stale: used `wrangler.jsonc`
      (not `.toml`, per the skill's current guidance) and `triggers.crons`
      for the cron trigger, `vars` for the two non-secret settings
      (`SEPOLIA_READ_RPC_URL` — keyless, explicitly not a secret per
      `config/README.md`'s READ path; `WATCHED_LABELS` — same
      placeholder-for-exercising-the-code value as D8's `.env`, not a
      decided demo name, D4). No secret is used anywhere in this item:
      nothing here touches `SESSION_PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY`,
      consistent with D7/D8 deferring all signing past the C1 gate.
      PLACEHOLDER, not decided: the cron cadence (`*/15 * * * *`). No
      document pins a poll interval for the Sepolia leg, the same gap
      `core.ts` already flags for the trigger-window seconds value. Written
      into `wrangler.jsonc` as a comment; confirm or replace, do not cite it
      as settled.
      Added `wrangler` itself as a project devDependency (it was only on
      PATH globally before, from somewhere outside this project, which
      isn't reproducible) — `npm install --save-dev wrangler@4.46.0`
      matched what was already on PATH, but that pulled in `npm audit`-
      flagged high-severity transitive vulnerabilities (`undici`, `ws`,
      `sharp`, all inside `wrangler`'s own local-dev-tooling dependency
      chain, i.e. `wrangler dev`'s simulator, not anything a deployed
      Worker runs). Upgraded to `wrangler@latest` (4.152.0) instead of
      accepting them: `npm audit` now reports 0 vulnerabilities, and the
      upgrade needed no code or config change. Added `.wrangler/` (its local
      dev state directory) to the root `.gitignore`.
      Did not deploy, and could not have: no Cloudflare credentials are
      configured for this session (`plugin:cloudflare:*` all show as
      requiring authentication), and deploying a real cron-triggered Worker
      to a live account is a materially bigger, harder-to-reverse action
      than building and locally verifying the entry point, which is what
      this item asks for. `wrangler deploy --dry-run` (bundles and validates
      config, no network call to deploy) is as far as this goes toward
      that.
      Verified by execution, not just by reading the code:
      - `tsc -p tsconfig.json` (the same root config D8 set up) — clean,
        `worker.ts` included via the `operator` entry in `include`.
      - `npx wrangler deploy --dry-run` from `operator/` — clean, bundled
        645 KiB / 135 KiB gzip, both `vars` bindings listed correctly. (The
        first attempt ran the stale global `wrangler` 4.46.0 still on PATH
        instead of the local devDependency and warned about the
        2026-10-22 compatibility date being past that version's supported
        range; re-ran with `npx` to confirm it actually uses the local,
        upgraded, 0-vulnerability install — it does. Compatibility date set
        to `2025-11-05`, the latest this machine's installed runtime
        actually supports, not the project's fictional "today".)
      - `npx wrangler dev --test-scheduled --port 8788` locally, then
        `curl http://localhost:8788/__scheduled` (the skill's documented
        way to trigger a `scheduled()` handler in dev, so `worker.ts`
        carries no extra `fetch` handler of its own just for testing) — ran
        twice, once on each `wrangler` version. Both times: 200 OK, and the
        dev server's console logged "operator/worker: connected to sepolia
        (chain 11155111) via https://evm.stupidtech.net/v1/11155111", then
        `estmcmxci` expiry `2027-01-09T17:33:00Z`, `insideWindow=false`,
        `expired=false` — the identical values D7 and D8 got, confirming
        all three (direct `cast`, the Node entry point against the fork,
        and this Worker against real Sepolia) agree. Confirmed with `pgrep`
        after each run that no `wrangler`/`workerd` process was left behind.
      Not verified: the actual cron firing on a real schedule (needs a
      deployment, out of reach this item) and the chain-id guard's failure
      path (same as D8, read as correct, not executed against a bad RPC).
- [x] O1. Operator submit: ERD.md 7.2 steps 3-5. NEW ITEM, added 2026-10-27 by
      the manager in answer to D10's option (a). D10 was right that no ledger
      item claimed this work and right not to improvise it.
      Build, in `operator/`, on top of the existing `decideWindow`/`readExpiry`:
      step 3, assemble and submit the renewal call with the session key;
      step 4, write the fallback address on a funding failure;
      step 5, record the attempt in a log D10 can read.
      The session key is `SESSION_PRIVATE_KEY` from the root `.env`
      (0xF1036508B1Eac3f8b4C3605d797905eDBCD515c5). It is a throwaway generated
      for this project. AGENTS.md hard rules 2 and 3 forbid the compromised key
      0x1C2F...fF21 and the estmcmxci.eth owner key; neither is this one, and
      using the session key to sign is the entire point of the feature.
      Addresses come from `config/networks.ts` only, including the new
      `ourStack` map (our private Sepolia deploy). Never hardcode.
      Policy parameters, decided by the manager 2026-10-27, record them in
      DECISIONS.md as D9 when you use them:
        - Fixed renewal duration 31557600 seconds (one year). Matches the
          value the passing test matrix already uses, so the demo and the
          proof cannot disagree. D4 is DECIDED, not open: fixed duration,
          capped spend. See DECISIONS.md D4.
        - Max spend per session = 2x the live oracle quote for the demo name,
          read at install time with getRenewPrice and recorded alongside the
          quote. Per-session, per D7, because the 4-char/9-char price spread
          is about 20x. The 2x is oracle headroom, not a budget.
      Run against the Sepolia fork first. Do not touch the frontend here.
      This item unblocks D10-D13 and evidence E7.
      2026-10-27: PARTIAL, not done, stopped at the budget. Read `ERD.md`
      7.2/7.3, `DECISIONS.md` D4/D5/D6, `config/networks.ts`, `.env.example`,
      `operator/{core,node,worker}.ts`, and `contracts-v2/contracts/src/hca/
      StandaloneSingleOwnerHCA.sol`, before writing any call-building code,
      per `AGENTS.md`'s "verify against deployed contracts, never a local
      ABI" and the `ensv2` skill's same instruction.
      Finding: the HCA (`StandaloneSingleOwnerHCA.sol:238,265`) is a
      Nexus-style ERC-4337 account. `validateUserOp` and `isValidSignature`
      both route through one fixed `_DEFAULT_VALIDATOR`
      (`HCAOwnerAndSessionValidator`), gated by the userOp nonce's encoded
      validator mode. Owner calls go through `executeByOwner` (line 233,
      `onlyOwner`); nothing in this file is session-key-specific, so the
      session path is `HCAOwnerAndSessionValidator.sol` itself, not read
      yet, plus `HCASmartSessionLib`/`HCARegistrarPolicyLib` for how a
      session's policy (which calls, which registrar, D5/D6's role and
      allowance shape) is encoded and checked at validation time.
      Still unread, needed before writing `submit`: (a)
      `HCAOwnerAndSessionValidator.sol`'s session-signature format, so the
      session key signs what the validator actually recovers against, not a
      guessed digest; (b) the `EntryPoint` address for Sepolia/the fork —
      absent from `config/networks.ts`, itself worth flagging as a gap if
      confirmed; (c) `HCAExecutionLib`/`HCAOperationHashLib` for the
      `Execution[]`/batch encoding `validateUserOp`'s callData check expects.
      Separately, found in `progress/evidence.md`: no HCA account instance
      exists anywhere yet, on Sepolia or the fork. E6 (done) deployed only
      the factory and implementation; E6.5 (added 2026-10-27, unchecked,
      owned by the evidence track, not this one) still has to call the
      factory's create function and register a name to it before any real
      renewal can fire against a *live* account. E6.5's own text names O1
      as the dependency in the other direction (it is waiting on this item
      for the renewal tx, not blocking it), so this is not a blocker on O1,
      but it does mean today's fork run needs ITS OWN locally-created test
      account + installed session (D8's established pattern: the fork is
      this project's test double, independent of Sepolia's real one, per
      `ERD.md` 7.3's mention of `00_MockRegistrationIntentExecutor.ts`) —
      separate setup work, not yet done, before step 3's code can be
      exercised even once.
      Not attempted: writing `submit`/fallback/log code against a guessed
      signature format or a nonexistent account, and not reaching for
      `executeByOwner` as a shortcut — it is owner-gated and would misstate
      what the demo proves (a session key, not the owner, renewing).
      Next beat: read `HCAOwnerAndSessionValidator.sol`,
      `HCASmartSessionLib.sol`, `HCAOperationHashLib.sol`, confirm the
      EntryPoint address, then build the fork-local test account + session
      before step 3's submit function.
      2026-10-27, continued: CORRECTION to the note above. Read
      `HCAOwnerAndSessionValidator.sol` in full (lines 240-1020) and
      `test/mocks/MockRegistrationIntentExecutor.sol`. The EntryPoint/UserOp
      path noted above does not apply to a session call: `validateUserOp`
      (line 283) only accepts an OWNER ECDSA signature ("Fixed sessions
      remain limited to the intent path", its own docstring); there is no
      `FIXED_SESSION_*` branch inside it. A session call instead goes
      through an "intent executor" contract, checked by
      `isValidSignatureWithSender` (line 258) requiring `sender ==
      INTENT_EXECUTOR`, an immutable set per-validator-deployment (line
      170, `01_HCAOwnerAndSessionValidator.ts` lines 36-44: resolved from
      `MockRegistrationIntentExecutor` locally or `HCA_INTENT_EXECUTOR`
      otherwise). Retracting the EntryPoint-address gap from the note
      above; that is not the missing piece.
      The actual entry point, confirmed from
      `test/mocks/MockRegistrationIntentExecutor.sol` lines 90-106:
      `executeWithSession(INexus account, Execution[] executions, uint256
      nonce, bytes signature)`. It builds an EIP-712 digest over the batch
      (domain "IntentExecutor"/"v0.0.1", `SINGLE_CHAIN_OPS_TYPEHASH(account,
      nonce, operationHash, gasRefundHash)`, `operationHash` over
      `ERC7579_ERC1271_MODE` and one `EXECUTION_TYPEHASH(target, value,
      keccak256(callData))` per execution, `gasRefundHash =
      NO_GAS_REFUND_HASH` with no refund — lines 185-241, fully spelled
      out, nothing guessed), calls `account.isValidSignature(digest,
      signature)`, and on success calls
      `account.executeFromExecutor(ModeLib.encodeSimpleBatch(),
      ExecLib.encodeBatch(executions))`. This mock is test-only
      (`test/mocks/`); a non-mock `IntentExecutor` exists for real
      deployments (`existingExecutor`/`HCA_INTENT_EXECUTOR` in the same
      deploy script) and is not yet located. Fine for the fork run the
      manager asked for first; the live-Sepolia DemoAccount's own baked-in
      `INTENT_EXECUTOR` (immutable, set at E6's validator deploy) has not
      been checked yet to see whether it is the mock or something else.
      Batch shape, now concrete from `_checkRenewMoneyCall`/`_checkRenewBatch`/
      `_checkRenewCall` (lines 908-1017), not re-derived from D6/D8 by
      guesswork: exactly three `Execution`s, any order, cross-checked after
      the loop —
        1. `token.approve(registrar, exactPrice)`, spender must equal the
           renew target (so spender itself must hold `ROLE_RENEW`, D8).
        2. `token.transferFrom(ownerEOA, hcaAccount, exactPrice)` — reverts
           `PolicyRuleFailed` unless the two addresses match
           `funding.owner`/`funding.account` exactly.
        3. `registrar.renew(RenewData{label, duration, referrer}, token)` —
           target must pass `_isAuthorizedRenewer` (`ROLE_RENEW`), must be
           `isRenewable(label)` first, `getRenewPrice` must not exceed
           `renewPolicy.maxSpend`, and `duration`/`token` must equal the
           session's signed `RenewPolicy` exactly.
      Still unread, still blocking a correct `signature` argument: what
      `executeWithSession`'s `signature` must actually contain once it
      reaches the HCA's `isValidSignature` → `isValidSignatureWithSender`
      → `_validateFixedSession` → `_validateFixedPermit2SessionEnable` /
      `_validatePermit2EnableIntent` chain (lines 344-539, not read past
      the first ~60 lines this beat): the `SessionEnableProof` struct
      layout, where `RenewPolicy` is bound inside it, and
      `HCASmartSessionLib`'s `packedSessions` encoding. Writing the
      `signature` bytes without reading these would be a guess at exactly
      the thing `isValidSignature` checks — the one place a mistake is
      silent (ERC-1271 returns a failure value, not a revert with a
      message) rather than loud.
      Also still open, found but not resolved this beat: the live
      DemoAccount (`0xe4F6BB...031F`, E6.5) has no standing ERC-20 allowance
      from its owner EOA (`0x41baA860...148F31`) yet — required for leg 2
      above — and no session has been enabled on it. Both are setup, not
      submission; whether they are O1's job or a prerequisite item (D13's
      "two signatures" may BE exactly this: the session-enable proof
      signature and something else, still unconfirmed) is also unresolved.
      Not attempted again this beat: guessing the signature envelope, or
      touching the live Sepolia DemoAccount.
      Next beat: read `SessionEnableProof`'s fields and
      `HCASmartSessionLib.sol` to get the signature envelope exactly, then
      decide (or ask) whether O1 also provisions the allowance + session
      enable, or whether that is a separate setup item.
      2026-10-27, continued (C4 landed since the note above): read
      `progress/contracts.md` C4, now DONE. `operator/session.ts` exports
      `buildRenewSessionPayload(inputs, keys)` returning exactly
      `{executions, operationData, permissionId, digest, envelope, proof,
      gasRefund}`, byte-equal to the Solidity fixture (5/5 vector
      assertions, 134/134 forge tests). That is the signature-envelope gap
      from the note above, closed — not by this item, by C4; nothing
      duplicated here. C4's own "what this does not prove" names the one
      thing left for O1: an `isValidSignature` call against the LIVE
      `ourStack.HCAOwnerAndSessionValidator` is unverified, and that read
      is O1's to make.
      Read it live rather than guess: `cast call` against
      `ourStack.HCAOwnerAndSessionValidator`
      (`0x8012Aa1a220F34f519A902C8f446823E0Dd363E5`) on
      `SEPOLIA_READ_RPC_URL`, function `INTENT_EXECUTOR()`, returns
      `0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF` — immutable, set at
      deploy, confirmed on chain, not from a local record. Grepped the repo
      for that exact address: it is `RHINESTONE_INTENT_EXECUTOR` in
      `contracts-v2/contracts/script/deploy-constants.ts:21-22`, and it is
      the SAME address baked into every HCA validator this project has
      deployed on Sepolia, across every dated namespace
      (`sepolia-20260629-r1` through `sepolia-autorenew` itself) — not the
      local `MockRegistrationIntentExecutor`.
      FINDING: this conflicts with `ERD.md` 7.3: "Do not depend on the live
      Rhinestone router for the demo. It puts a third party on the
      critical path and the demo must repeat on command." The live
      DemoAccount's validator (E6.5, the one with a real registered name on
      it) is permanently bound to the real Rhinestone executor, by
      constructor argument, immutable, so that specific account cannot be
      rebound to the local mock later.
      What submitting through the real executor actually requires, found
      in `script/liveHcaRhinestoneRegistration.ts` (5283 lines, already in
      this repo): `@rhinestone/sdk`'s `RhinestoneSDK({ auth: { mode:
      "apiKey", apiKey: RHINESTONE_API_KEY } })`, i.e. Rhinestone's hosted
      relayer/API, not a plain contract call this project controls end to
      end. That is exactly the third-party dependency ERD 7.3 says to
      avoid, and it needs `RHINESTONE_API_KEY`, not currently in
      `.env.example`.
      Not attempted: calling the live Rhinestone executor or its hosted
      API, or treating E6.5's real registration as wasted — flagged to the
      manager instead, since it bears on whether that account can serve
      the demo's repeatable renewal or only a one-off, API-key-gated real
      transaction for evidence.
      Plan, pending the manager's answer: build and exercise O1's submit
      path against a FRESH fork-local HCA account + validator, deployed
      with the local `MockRegistrationIntentExecutor`
      (`00_MockRegistrationIntentExecutor.ts`) as its `INTENT_EXECUTOR`,
      per `ERD.md` 7.3's own stated preference — not against E6.5's live
      DemoAccount, which this beat's reading says cannot take a plain
      transaction for its session leg at all.
      2026-10-27, continued: no response yet, not idling on it since this
      part is independent of that question. Found the exact call shape to
      write against, so the next beat does not have to derive it:
      `contracts-v2/contracts/test/e2e/hca.test.ts:757-776`,
      `executeHcaIntent` calls
      `stack.executor.write.executeWithSession([hca, executions, nonce,
      signature])` through viem, against a locally-deployed
      `MockRegistrationIntentExecutor` (`env.hca.MockRegistrationIntentExecutor`,
      line 202). Fields line up 1:1 with `session.ts`'s
      `RenewSessionPayload`: `hca` = `ourStack.DemoAccount` (or a fork-local
      one), `executions`/`signature` = the payload's `executions`/`envelope`,
      `nonce` = the session nonce the payload was built against. This test
      is registration-flavored, not renewal, but the submission call itself
      is generic over the batch — confirms the transport, not a new unknown.
      Checked for a reusable renewal-via-executor fixture first, rather
      than writing one blind: none exists. `MockRegistrationIntentExecutor`
      is referenced only in its own source; every `AutoRenewPolicy.t.sol`
      case calls `hca.validate()` directly (confirmed again, grep, zero
      hits for `executeWithSession` outside this one e2e file). So no test
      anywhere currently exercises a session renewal through the executor
      end to end; O1 is the first.
      This `hca.test.ts` harness is Bun-test-driven (`bun:test`,
      line 1), its own ephemeral chain per run, not a long-lived RPC port.
      `ERD.md` 6.2 wants a real standalone `anvil --fork-url` process the
      frontend/operator both point at by port, matching `operator/node.ts`
      (D8)'s pattern. So the next concrete step is deploying the HCA stack
      (factory, implementation, mock executor, validator) onto a real
      anvil fork via the existing `deploy/hca/*.ts` rocketh scripts — the
      same mechanism E6 used on live Sepolia, pointed at localhost instead
      — not reusing this Bun fixture as the demo's running target. Not
      started this beat; a fresh beat's full budget suits a multi-step
      deploy sequence better than the tail end of this one.
      2026-10-27, continued: checked what is actually running before
      deploying anything. Two anvil processes already up: PID 89631, port
      8545, plain `--chain-id 31337`, NOT a Sepolia fork — this is the
      unrelated anvil `progress/contracts.md` S2 already documented, still
      there, still not this project's. PID 90427, port 8546, `anvil
      --fork-url <the Alchemy Sepolia URL>` — this project's fork, matching
      `ERD.md` 6.2. Confirmed live: `cast chain-id` returns `11155111`.
      Checked whether it already carries E6.5's live state before assuming
      either way: `cast block-number` on it returns `11,971,358`, before
      E6.5's register tx at block `12,007,695` (and probably before E6
      too), and `cast codesize` on `0xe4F6BB...031F` (DemoAccount) returns
      `0`. So this fork predates the live account and does not need to
      carry it — unaffected either way, since the plan is a SEPARATE
      fresh test stack on top of this fork, not reuse of the live
      DemoAccount (which stays unusable here regardless of fork block,
      being bound to the real Rhinestone executor by immutable
      constructor arg, not by chain state).
      Found the exact deploy invocation E6 used, to repeat the same
      mechanism rather than inventing a new one:
      `progress/evidence.md` E6's method notes read `bun
      ./script/migrate.ts phase deploy-v2 --network sepolia --resume --tags
      hca --deployment-network <name>`.
      FLAGGED BEFORE RUNNING, not after: `--network sepolia` in
      `hardhat.config.ts:126-131` reads its RPC from `configVariable(
      "SEPOLIA_RPC_URL")`, and `.env`'s `SEPOLIA_RPC_URL` is the live
      Alchemy endpoint — the SAME one the running fork was forked from.
      Run the E6 command unmodified and it deploys to LIVE Sepolia again,
      not the fork, duplicating real transactions and real token spend
      next to E6.5's already-careful work, for no reason. Confirmed
      `contracts-v2` has no separate `.env` of its own overriding this.
      Not attempted this beat, deliberately: running the deploy command.
      Next beat, in order: (1) re-confirm the fork is still up and still
      chain id `11155111` immediately before anything, since a stale
      assumption here is exactly how the mistake above would happen; (2)
      run the deploy with `SEPOLIA_RPC_URL=http://127.0.0.1:8546` set
      ONLY for that one command's environment, never written into `.env`
      itself; (3) use a `--deployment-network` name distinct from
      `sepolia-autorenew` (not yet picked) so the fork-local test stack's
      records can never be mistaken for E6/E6.5's live ones; (4) confirm
      no `HCA_INTENT_EXECUTOR` env var is set, so `resolveHCAIntentExecutor`
      deploys the local `MockRegistrationIntentExecutor` rather than
      pointing at `RHINESTONE_INTENT_EXECUTOR` again.
      2026-10-27, continued, per the manager's direction: started a FRESH
      fork at the current block on port 8547 (not 8546, left alone as
      told), `anvil --fork-url` the dedicated provider. Confirmed live:
      chain id `11155111`, block `12,007,885` (after E6.5's block
      `12,007,695`), `DemoAccount` codesize `77` — the fork does carry the
      live account this time.
      Wrote `operator/submit.ts` (`submitRenewal`, calls
      `executeWithSessionAndRefund` with `session.ts`'s payload, per the
      refund-mode envelope C4 builds) and a throwaway runner,
      `operator/submit.fork-check.ts`, to exercise it. Live reads worked:
      `getRenewPrice` 8,005,501 raw MockUSDC, `ownerAndSessionNonce` 0,
      `INTENT_EXECUTOR()` read live (not hardcoded) =
      `0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF`, matching the earlier
      finding. Funded the owner and granted the standing allowance on the
      fork only (mint + approve, deployer key, mirroring E5/E6.5's real
      pattern) since neither exists yet for real.
      RESULT: `executeWithSessionAndRefund` reverts with EMPTY revert data
      (`0x`) against the live, current-block `RHINESTONE_INTENT_EXECUTOR`.
      Checked this was not a balance/gas mistake first (first attempt used
      the session key as sender and failed differently, "gas required
      exceeds allowance: 0" — fixed by paying gas from the funded deployer
      instead; the empty-data revert is a SECOND, different failure after
      that fix). Checked it was not a false reading of an ordinary revert
      either: called a deliberately nonexistent selector
      (`thisDoesNotExist()`) against the same address and got the
      IDENTICAL empty-data revert, and the known selector
      `0x9220cae3`/`executeWithSession` (no refund) matches it too. A real
      matching function failing on its own logic would be expected to
      bubble a reason (an `Error(string)` or a custom error selector, the
      way `InvalidSignature()` or `PolicyRuleFailed()` would show up as
      non-empty data); "identical to a selector that provably does not
      exist" is the signature of an unmatched call, not a rejected one.
      CONCLUSION, now tested rather than inferred from
      `liveHcaRhinestoneRegistration.ts`'s SDK usage alone: the real,
      live `RHINESTONE_INTENT_EXECUTOR` does not expose
      `executeWithSession`/`executeWithSessionAndRefund` as callable
      functions at all. `MockRegistrationIntentExecutor` reproduces the
      EIP-712 DIGEST scheme the validator checks (confirmed by its own
      doc comments, "Reproduces the production IntentExecutor's ...
      digest"), not the real contract's external interface. So forking
      does not sidestep the gap flagged earlier: the live `DemoAccount`'s
      validator is bound to the real executor by an IMMUTABLE constructor
      argument, which a fork copies verbatim along with everything else.
      No fork, fresh or stale, makes a plain call to that account's
      session path succeed; the binding is bytecode-level, not
      state-level.
      Not attempted: guessing the real executor's actual interface, or
      retrying with more selector guesses — that is Rhinestone's own,
      undocumented-here contract, and brute-forcing selectors against a
      live contract (even on a fork) is exactly the kind of guessing
      `AGENTS.md` says not to do.
      Flagged to the manager rather than deciding alone: a fresh validator
      + account bound to the LOCAL mock executor needs deploying after
      all, to exercise O1 end to end — on the already-safe fork at 8547,
      not live Sepolia, so the earlier RPC hazard does not recur.
      2026-10-27, continued, with the manager's go-ahead: deployed a fresh
      validator/factory/implementation/account bound to the local mock,
      directly with `forge create`/`cast send` (bypassing rocketh, same
      technique `progress/evidence.md` E6 used for three of its five
      `ourStack` contracts), ONLY against the fork at 8547, confirmed still
      up and on chain id `11155111` immediately before anything. Reused
      the live stack's other six HCA constructor args as-is (adapters,
      `ETHRegistry`, `VerifiableFactory`, `HCAUpgradeSet`, gas-refund
      paymaster — decoded from the live deployment records with `cast
      abi-decode --input`, not retyped from memory), swapping only
      `intentExecutor` for the fresh mock. Topped up the deployer's ETH
      with `anvil_setBalance` when the first attempt failed on gas (the
      real Sepolia balance, faithfully carried over by the fork, was too
      low) — fork-only, the same kind of test-setup grant as the token
      mint/approve already done, never done against live Sepolia.
      FORK-ONLY addresses, exist nowhere else, never to be read as
      `config/networks.ts` values: mock executor
      `0x901eD86584D06bD1f21627FC13cD01bd815e14FE`, validator
      `0x886642d239839e746Cfd327d9CFE7FC35b374aD0`, factory
      `0x39777e394ECA2318043a3d379b60aE0D58bcdC49`, implementation
      `0x9C1297377312427F025992eE060b54aC538147C8`, account
      `0x299e8F22259E85263d0E641329D21cb8Bac103Fb` (owner = the same EOA
      `0x41baA860...` as the real `demoName`, so the existing
      `autorenewdemo` registration binds to this new account too —
      `getState(...).latestOwner` and the account's own `owner()` already
      match; no new registration needed).
      Wrote `operator/submit.ts` (`submitRenewal`, the real module:
      prepends the 20-byte zero validator prefix
      `StandaloneSingleOwnerHCA.sol:265-290`'s `isValidSignature` requires
      — found by reading its doc comment after the FIRST attempt reverted
      `ValidatorNotInstalled(address)` with the envelope's own first 20
      bytes misread as a module address, not guessed — then calls
      `executeWithSessionAndRefund` with `session.ts`'s payload) and
      `operator/submit.mock-fork-check.ts` (a throwaway runner, not part
      of the shipped path, labelled in its own header as mock/fork-only
      throughout).
      POSITIVE CASE, run against the MOCK executor on the fork, not the
      real one: tx `0x3780151dc0390dd3e6bcca805b6143d6c17dbe0276163db2fef14625be89f27d`,
      status success, gas 231,543. Five events: ERC20 `Transfer` (owner to
      account, the pull), ERC20 `Approval` (account approves the
      registrar), an `ETHRegistry` event carrying the new expiry packed
      into its topic (`0x...70aa9325`, decimal matches the read-back value
      exactly), an `ETHRegistrar` renewal event, and a FINAL ERC20
      `Transfer` from the account to `0x84D3A426D4E12E955d1DF95db0b24Fe26AFE39D3`
      — `governance.sepolia.deployerRoot` in `config/networks.ts` — not
      anticipated, not yet explained; flagging rather than guessing: likely
      the gas-refund leg the `GasRefund` struct exists for, but which
      address receives it and why was not traced this beat.
      Expiry before `1858669381` (2028-11-24T09:03:01Z), after
      `1890226981` (2029-11-24T15:03:01Z) — note these are the SECOND
      renewal's numbers in a multi-run session; the delta is what matters
      and held exactly across every run. Delta: exactly `31557600`
      seconds, D9's fixed duration, every time, across three separate
      successful runs in this beat alone (the account has now been
      renewed three years forward from its original 28-day registration).
      Allowance: before `8005501`, after `0`, decrement `8005501` — exactly
      `renewPrice`, every run, because the test approves exactly that much
      each time. Envelope: 943 bytes.
      NEGATIVE CASES — a real finding about the account's own design, not
      a test bug, found when the first attempt gave an unhelpfully generic
      answer: submitting a batch with a spend above `maxRenewSpend`, or a
      genuine mismatch between the SIGNED session's `renewalDuration` and
      the EXECUTED batch's `rd.duration` (built with the lower-level
      `session.ts` exports directly, signing the real duration but
      executing one second more, since the duration is fixed per D4/D7 and
      either direction must revert), both revert at the TRANSACTION level
      with only the generic `InvalidSignature()` (`0x8baa579f`), not
      `PolicyRuleFailed`. Read why rather than assume the policy check
      didn't run: `StandaloneSingleOwnerHCA.sol`'s `isValidSignature`
      wraps the validator call in `try/catch` and returns the ERC-1271
      failure value `0xffffffff` on ANY revert from the validator,
      including a policy rejection — by design, so a probing caller can't
      learn WHICH check failed. The mock executor then sees the magic-value
      mismatch and reverts its own generic error. So `PolicyRuleFailed`
      never reaches the top-level transaction revert data on this path,
      for either negative case, EVER — not a sign the check didn't run.
      Confirmed the check DOES run and DOES reject correctly by calling
      the validator's own `isValidSignatureWithSender(sender, hash, data)`
      directly — it takes the forwarding account as an explicit argument,
      not `msg.sender`, so no impersonation is needed, just the correct
      `account:` context on the read (the validator's internal
      `_ownerAndSessionNonce` reads `msg.sender` as the account to query;
      a plain call with no account set queries the wrong address and gives
      a misleading result — caught by comparing against the known-working
      positive case before trusting the diagnostic). Both negative cases:
      `0xe50c42ea`, decoded against every error in `src/` and `lib/`
      (not assumed from the name), is `PolicyRuleFailed()`. Confirmed,
      not inferred.
      LABELLING, per the manager's hard constraint: every result above is
      from the LOCAL MOCK executor on the fork at 8547. None of it is
      evidence that the real `RHINESTONE_INTENT_EXECUTOR` accepts this
      shape of call — that question is open and is contracts' to answer
      via `script/liveHcaRhinestoneRegistration.ts`, not duplicated here.
      STILL NOT DONE: O1's steps 4 (write the fallback address on a
      funding failure) and 5 (record the attempt in a log D10 can read).
      Step 3 (assemble and submit with the session key) is now proven
      against the mock/fork; O1 is not checked off.
      2026-10-27, continued: read `progress/contracts.md` C6 (DONE), the
      manager's parallel real-executor investigation. It names gap 2 as
      open: whether `session.ts`'s `operationData` matches
      `Types.Operation.data` the real executor expects. Pulled the
      VERIFIED source for the real implementation
      (`0x194DE341d4791e9b8922eE1bC018DFd1fD1b115A`) directly from Sepolia
      Etherscan (`api.etherscan.io/v2/api`, `ETHERSCAN_API_KEY`, V2
      endpoint — the V1 one `.env`'s comment implies is deprecated,
      confirmed by the error message), not guessed, to close that gap:
      `src/common/SmartExecutionLib.sol:193-194`,
      `function encode(SigMode sigMode, Execution[] memory exec) ...
      { ops.data = abi.encodePacked(Type.ERC7579, sigMode,
      abi.encode(exec)); }`. So `ops.data` is exactly 1 byte
      (`Type.ERC7579`, enum value 2) + 1 byte (`SigMode`, almost certainly
      `ERC1271` = 1 for a plain session signature, not yet confirmed
      against a passing call) + a PLAIN `abi.encode(Execution[])` — NOT
      the mock's `ExecLib.encodeBatch` wire format. Whether `session.ts`'s
      `encodeExecutions`/`operationData` already produces this, or
      produces the mock-compatible shape instead, was NOT checked this
      beat.
      NOT CONTINUING this thread past recording it. `progress/contracts.md`
      C6 is the manager's assignment to contracts, explicitly to avoid
      duplication; building the real-executor call is contracts' next gap
      to close, not this item's. Relaying the finding (verified source,
      exact file/line, exact encoding) rather than sitting on it or
      finishing their item myself. Returning to O1's own remaining scope:
      steps 4 and 5, still not started.
      2026-10-27, continued, per the manager's direction and C7 (now DONE):
      refactored `operator/submit.ts` into two clearly separated functions
      instead of one — `submitMockRenewal` (unchanged behavior, the
      fork-local `MockRegistrationIntentExecutor`'s
      `executeWithSessionAndRefund`) and `submitRealRenewal` (new, the
      real verified `IntentExecutor`'s no-refund `executeSinglechainOps`,
      per the manager's explicit instruction not to use the ERC-20 refund
      variant). Both now take `payload.accountSignature` directly from
      `session.ts` (C7's export) instead of this file re-deriving the
      20-byte prefix itself, removing the duplication. `submitRealRenewal`
      uses the literal JSON ABI fetched from Etherscan (not a hand-typed
      human-readable string — `parseAbi` with nested `struct` composition
      did not type-check cleanly for this shape, so the literal `as const`
      array is both simpler and not hand-guessed).
      NOT FIRED against live Sepolia. `progress/contracts.md` C7's own
      text: gap 2 (the `executorOpsData`/`ops.data` encoding) is "BUILT
      but NOT PROVEN" — the live `executeSinglechainOps` simulation
      reverts with empty data, and contracts' own next step is "a real
      trace rather than another guess." The manager's "once C7 lands, we
      go for the real one" and C7's own "I cannot produce an authoritative
      vector for the ops encoding" do not both hold at once; reading C7 in
      full rather than taking "C7 is done" as "it works," and asked the
      manager directly rather than guessing which one governs.
      Fixed the three `tsc` failures C7 flagged as demo's: added `chain:
      null` to the `writeContract` calls that needed it (viem's stricter
      typing, unrelated to the function-name issue C7's note described),
      removed two now-unused imports. Deleted
      `operator/submit.fork-check.ts` rather than patch it: it tested
      `ourStack.DemoAccount` (the real, Rhinestone-bound account) with the
      MOCK's function names, a combination this beat's own earlier finding
      already showed cannot work; `submit.mock-fork-check.ts` already
      supersedes everything it proved, and the finding itself is preserved
      above, not lost by deleting the script.
      Reran the full mock/fork suite after the refactor to confirm nothing
      broke: positive, durationAboveCap, spendAboveCap all produced the
      identical results as before (tx `0x3d527915bc2a72f96fe933d963d2349c9d9dbb8a41276e3e086eac155ed29fe2`,
      status success, expiry delta exactly `31557600` seconds, allowance
      decrement exactly `renewPrice`; both negative cases confirmed
      `PolicyRuleFailed` `0xe50c42ea` via the same direct-validator
      diagnostic as before). `npx tsc --noEmit` clean on every file that
      is this item's.
      2026-10-27, continued: `progress/evidence.md` E7 is now DONE — the
      manager fired a real renewal on live Sepolia after C7, tx
      `0x5c8e9a9d1b3a7ba0235377c85f251e9dad40a2900dd206b7341a96fa7051eb95`,
      status 1, selector `0x8f5c3522` independently confirmed as
      `executeSinglechainOps` (not the refund variant), expiry delta
      exactly `31557600` seconds, validator trace showing
      `isValidSignatureWithSender` returning the ERC-1271 magic value
      through our patched `0x8012Aa1a...`. So the flag raised above (C7
      said gap 2 was unproven) resolved in the manager's favor, not mine —
      whatever the fix was is not written in this file. Not claiming
      `submitRealRenewal` (this item's own code, same ABI, same no-refund
      entry point, written before this news arrived) was what fired it,
      or that it is now proven correct by association; it has not been
      run. Noting the real strong signal — same selector, same
      entry-point choice — and moving on, not re-deriving E7's numbers,
      which already carries its own independent re-verification.
      Continuing O1's own remaining scope (steps 4 and 5) against the
      mock/fork, as instructed.
      2026-10-27, continued: STEP 5 DONE AND TESTED. Read `ERD.md` 8.2 and
      `DEMO-SCRIPT.md` first for the exact shape the right pane needs
      ("✓ renew <name> 1 year 5.00 USDC / owner matches · within duration
      cap · within spend cap", "✗ renew <name> 1 year / rejected ·
      duration above the cap") rather than inventing a log format.
      Wrote `operator/log.ts` (`appendAttempt`/`readAttempts`, append-only
      JSON Lines, `source: "mock-fork" | "live-sepolia"` on every entry so
      D10 can never confuse the two) and `operator/attempt.ts`
      (`attemptRenewal`): reads live balance, allowance, and the registry's
      `getState` BEFORE building or sending anything, compares against the
      session's own signed policy, and only submits when every check
      passes. This answers the swallow-wrapper problem from earlier in
      this item the same way the diagnostic did: the only way to log a
      TRUE, specific reason instead of a generic one is to check what the
      validator will check, first, against live reads.
      Real bug caught before trusting it, not after: the first
      `getState` ABI guessed `(uint8 status, address latestOwner)`, two
      fields. It did NOT revert; it returned a plausible-looking but
      WRONG address (mostly zero bytes). Read
      `IPermissionedRegistry.State` (`src/registry/interfaces/
      IPermissionedRegistry.sol:30-36`): five fields, `status, expiry,
      latestOwner, tokenId, resource`, not two -- the missing `uint64
      expiry` field shifted every byte after it, including `latestOwner`.
      Caught by cross-checking a `cast call` of the SAME input against the
      KNOWN real owner, not by the TS compiling cleanly or the call
      succeeding -- neither would have caught this.
      Tested, `operator/attempt.mock-fork-check.ts`, four scenarios, all
      against the fork-local mock stack (labelled `mock-fork` in every log
      entry):
        ✓ renew  autorenewdemo  1y  [mock-fork]
          owner matches · within duration cap · within spend cap
        ✗ renew  autorenewdemo  1.00000003...y  [mock-fork]
          duration above the cap
        ✗ renew  autorenewdemo  1y  [mock-fork]
          spend above the cap
        ✗ renew  autorenewdemo  1y  [mock-fork]
          funding source empty
      The three rejections sent NO transaction (confirmed: `fired: false`
      in each result, no tx hash), matching DEMO-SCRIPT.md's own "no
      change, nothing happened" framing for a rejection and spending no
      gas on a doomed call. The success case did fire a real (fork) tx,
      `0x5eb685f663e79fcce256769703eb737cc577673bc4b6a7bd99cb1fe30be1932d`,
      status success.
      STEP 4, STILL OPEN: `attemptRenewal` now correctly DETECTS a funding
      failure (pre-flight, from live balance/allowance reads, no gas
      spent) and logs it, but does not yet follow up with the fallback
      write DEMO-SCRIPT.md beat 5 shows next:
        ✓ setAddress  <name>  0xBACK…9f
          permitted by the existing policy · no change requested
      That call is NOT a renew-session call: it is a resolver record
      write, checked by a DIFFERENT validator path
      (`HCAResolverPolicyLib._isRecordSelector`/`_checkResolverCall`,
      `HCAOwnerAndSessionValidator.sol` ~1181-1190), which this item has
      not read in depth. Open, unread questions, named rather than
      guessed: whether the EXISTING renew session's `SessionEnableProof`
      (its `resolver` field is `0x0` in every proof built so far) already
      covers a setAddress call, or whether a resolver-bound session needs
      its own, differently-shaped enable proof; which resolver address
      "autorenewdemo" actually uses; and whether `session.ts` needs a new
      exported builder for this, the way C4 built one for renew. Not
      started blind, the same discipline as the executor-transport
      question earlier in this item, which took real reading before it
      was safe to write code against.
      2026-10-27, continued: `progress/contracts.md` C8 answered exactly
      the open questions above (assigned to contracts after the real
      renewal, not duplicated here). Summary, not re-derived: (1) the
      validator already allowlists `setAddress`'s selector, no contract
      change; (2) the session's `proof.resolver` must NAME the resolver —
      our renew proofs all set it to `0x0` on purpose, and C8 measured
      live that a `resolver=0` session is refused (`0xffffffff`) for a
      setAddress execution; (3) that resolver must be a `VerifiableFactory`
      proxy of `PERMITTED_RESOLVER_IMPL`
      (`0x115eb53F0c60696633855F90b138178Fb40b2b2C`), not any resolver;
      (4) a role grant (`grantRoles`, `ROLE_SET_ADDRESS = 1 << 0`, scoped
      to the coin type, not the name) is needed ONLY when the resolver was
      not deployed through the HCA's own register path; (5) MEASURED:
      `autorenewdemo` has NO resolver set at all
      (`getResolver("autorenewdemo")` returns the zero address) — it was
      registered directly by the EOA, not through the HCA, so there is no
      HCA-deployed resolver and no role grant either. C8 explicitly: "a
      conforming resolver proxy deployed on Sepolia... is a state change
      and is demo's to make."
      So step 4's remaining work, now fully scoped rather than open
      questions: (a) deploy a conforming resolver proxy (fork first, per
      this item's own established discipline) via
      `VerifiableFactory.deployProxy(PERMITTED_RESOLVER_IMPL, salt,
      initData)`; (b) set it as `autorenewdemo`'s resolver; (c) grant the
      HCA account `ROLE_SET_ADDRESS` on it, since this name was not
      registered through the HCA; (d) build a setAddress session proof
      with `resolver` naming it (session.ts has no exported builder for
      this shape yet — only the renew one); (e) wire the result into
      `attempt.ts`/`log.ts` as the actual fallback write, completing step
      4. Not started this beat: (a) alone is its own unit of work (find
      `VerifiableFactory`'s exact `deployProxy` signature and
      `PermissionedResolverInitializable.initialize`'s exact grant
      encoding, both unread by this item so far), and rushing it after an
      already long beat risks the same kind of guess this item has twice
      caught itself making. Next beat starts there.
      2026-10-27, continued, per the manager's instruction. The manager
      proposed exactly the diagnostic this item had already run once as a
      one-off check (the duration/spend cap tests, above) as the PRIMARY
      source for a rejection reason, not a secondary one: call the
      validator's `isValidSignatureWithSender` directly, `sender` set to
      the intent executor as an explicit argument (not `msg.sender` —
      `account:` on the read is what gives the validator's own
      `_ownerAndSessionNonce(msg.sender)` the right address to query, no
      impersonation needed). Already confirmed working; upgraded
      `attempt.ts` to use it for every rejection the validator's policy
      can explain, rather than asserting a reason from live reads alone.
      `operator/log.ts` gained `reasonSource: "contract-revert" |
      "live-read" | "tx-receipt"` on every entry, per the manager's
      explicit labelling requirement, so the pane never lets a computed
      reason pass as a contract one.
      One caveat recorded rather than glossed over: `PolicyRuleFailed`
      carries no arguments and is the SAME error for owner binding,
      duration, and spend, so confirming it bubbles proves a rejection is
      REAL, not WHICH check caused it — that attribution is still the
      operator's own, from knowing which single input it deliberately
      pushed out of bounds. Documented in `attempt.ts`'s own header so the
      distinction is never lost to a future reader.
      REAL BUG FOUND BUILDING THIS, not papered over: the first version
      called `buildRenewSessionPayload({...inputs, duration:
      requestedDuration})` for the duration-cap test, which signs the
      PROOF and builds the EXECUTIONS from the SAME duration — so a
      "mismatch" test always produced a self-consistent batch, and the
      validator correctly ACCEPTED it. Wrong test, not a wrong validator;
      a real session is signed ONCE at setup (D13) and reused across
      attempts, so testing a mismatch means holding the SIGNED duration
      fixed while the EXECUTIONS vary. Added `buildAttemptPayload` (mirrors
      `buildRenewSessionPayload`'s body field for field, using the
      lower-level exports, with `signedDuration` for the proof and
      `requestedDuration` for the executions) to fix it, rather than
      patch the symptom. Also added a safety branch: if a pre-check
      expects a rejection and the validator does NOT confirm one, the
      entry records that disagreement explicitly instead of asserting the
      unconfirmed reason — caught this exact case while debugging the bug
      above, before the fix, and it is what surfaced the bug rather than
      a wrong log entry passing quietly.
      Reran the four-scenario suite after the fix: success (real tx,
      unchanged), duration-above-cap and spend-above-cap both now
      CONFIRMED via `0xe50c42ea`/`PolicyRuleFailed` as real revert data
      (`reasonSource: "contract-revert"`), funding-empty still
      `"live-read"` (the validator has no check to confirm against for
      this one, stated in `attempt.ts`'s own header, not assumed). `npx
      tsc --noEmit` clean.
      Per the manager's "then D10": O1 steps 3 and 5 are done and tested;
      step 4 (the fallback write itself) remains scoped but unbuilt per
      the note above. Starting D10 next beat — the frontend wiring is a
      different surface (app/) than anything touched so far in this item.
      2026-10-27, continued. CORRECTION to the "C7 gap 2 resolved" framing
      above, from the manager, recorded here because it is the truth and
      I had guessed wrong at why it worked. The real renewal
      (`0x5c8e9a9d...`) was fired by a throwaway script, not by this
      item's `submit.ts`/`attempt.ts` — it called `buildRenewSessionPayload`
      and `executeSinglechainOpsCalldata` from `session.ts` directly, sent
      to the IntentExecutor with the no-refund entry point, and was
      deleted after sending. GAP 2 WAS NEVER AN ENCODING PROBLEM: the
      first live simulation reverted because the owner's allowance to the
      HCA was ZERO (the batch's first execution is `transferFrom owner ->
      HCA`), not because `executorOpsData` was wrong. The manager sent an
      approve, `0xeb9820aeee6ebd5834e6773a8b9c08271056e75342a206ba9fab6c11e608116b`,
      block 12,008,103, 16,011,002 raw MockUSDC (2x the 8,005,501 quote,
      D9), and the SAME simulation then returned success unchanged. So
      the ops encoding is proven ONLY by one live transaction succeeding,
      not by any vector, and `operator/submit.ts`'s `submitRealRenewal`
      remains UNPROVEN against live Sepolia — stated here, not rounded up,
      because the manager was explicit that I should keep saying so until
      I prove it myself.
      THE REMAINING ALLOWANCE IS EXACTLY ONE MORE RENEWAL: 8,005,501,
      matching the current quote, per the manager. Proving `submit.ts`
      end to end on live Sepolia, using it, is next — before D10, since
      the manager named it the immediate next step and D10 should wire to
      a tx hash this item's own code produced, not one it only read about.
      2026-10-27, continued: DONE. `submit.ts`'s `submitRealRenewal` is now
      PROVEN against live Sepolia, by this item's own code, not by
      association with the manager's deleted script.
      Wrote `operator/submit.live-check.ts`: reads every live value fresh
      (price, allowance, balance, expiry, session nonce, deployer ETH),
      refuses to proceed if funding is short, builds the real payload via
      `buildRenewSessionPayload` once, SIMULATES the exact
      `executeSinglechainOps` call via `publicClient.simulateContract`
      first (the manager's own methodology: simulate, confirm, only then
      broadcast), and only calls `submitRealRenewal` after the simulation
      succeeds. `buildRenewSessionPayload` is deterministic (RFC 6979
      signing, no randomness), so the real send reproduces the exact
      payload the simulation checked, not a second, different one.
      RESULT, independently re-read after sending, not taken from the
      script's own printed receipt alone: tx
      `0xa2ce0c948ef6adb68a161d81736d68b3e22aebcffa9ba7583b98c3f176e4e299`,
      block 12,008,219, status success, gas 358,727 (same order as the
      manager's own renewal, 370,240 — both real `executeSinglechainOps`
      calls through the same real executor, not the mock). Six logs, same
      count as the manager's renewal: the pull, the approve, the registry
      event, the registrar event, the same unexplained final transfer to
      `governance.sepolia.deployerRoot` noted and still unexplained
      earlier in this item, and one more log at the executor's own
      address not yet decoded.
      Expiry before `1827111780`, after `1858669380`, delta exactly
      `31557600` seconds — D9's fixed duration, matching every prior
      renewal in this item and the manager's.
      Allowance before `8005501` (exactly the live quote, as the manager
      said), after `0`, decrement exactly `8005501`. The account's
      renewal allowance is now fully spent; a further renewal needs a new
      approve from the owner before it can fire again, on this account or
      the fork.
      This is now the tx D10 wires to: produced by this item's own
      `submit.ts`, not read about secondhand.
      2026-10-27, continued: `progress/evidence.md` E9 landed while this
      item was moving toward D10 — the manager had contracts deploy a
      conforming resolver, set it on `autorenewdemo`, and grant the HCA
      account `ROLE_SET_ADDRESS` (via `grantSetterRoles`, a real
      correction to C8 section 4, which only read the base
      `EnhancedAccessControl.grantRoles` and missed the resolver's
      override). That closes the precondition O1's step 4 was blocked on;
      this item picked step 4 back up rather than going straight to D10,
      since O1 sits ahead of D10 in this file and the fallback work is
      now actually buildable.
      Wrote `operator/fallback.ts`: `buildFallbackPayload` mirrors
      `operator/c8-probe.ts`'s PROVEN case B construction exactly (start
      from the renew-proof builder, override `proof.resolver`, then
      recompute the salt/permissionId/owner-authorization that depend on
      it — resolver is one of the ten fields the salt hashes, so patching
      `proof.resolver` alone without recomputing downstream would sign a
      stale digest), generalized from the probe's harmless self-address
      to a real `fallbackAddress` parameter, and `submitFallback` to send
      it through the same `executeSinglechainOps` transport `submit.ts`
      uses (generic over the batch; it does not care whether the batch is
      a renewal or one `setAddress` call). Built entirely from session.ts's
      EXISTING exports — added nothing to that file, so the clean boundary
      holds.
      CONFIRMED, read-only, sends nothing: `operator/fallback.live-check.ts`
      calls the live validator's `isValidSignatureWithSender` directly
      (same bypass-the-swallow-wrapper technique as the diagnostic above)
      with a real payload built for `FALLBACK_ADDRESS` from `.env`
      (`0xc1445f70...`), against the live resolver E9 deployed
      (`0xF26C66e1...`). Result: `0x1626ba7e`, the ERC-1271 magic value —
      ACCEPTED, matching the probe's case B.
      NOT YET DONE: an actual send. The construction is proven accepted;
      firing it for real (and reading the address record before and after,
      which needs the resolver's own read-side ABI, not yet located) is
      the next concrete step, not attempted this beat.
      2026-10-27, continued: DONE. Fired the real fallback write, not just
      the diagnostic. `operator/fallback.live-check.ts` rebuilt to hold
      ONE fixed `nonce` across the diagnostic, the simulation, and the
      real send — the first draft called `buildFallbackPayload` once for
      the diagnostic but then independently generated a FRESH nonce for
      the simulate step and another for the final send, so the three
      checks would have proven nothing about what actually got sent; same
      bug class as the duration-mismatch one earlier in this item, caught
      before running it this time, not after.
      RESULT: tx
      `0x1daf07559df24d1da34bce945d17a160a20285a02ce530d8e6c516c3b0e27027`,
      block 12,008,365, status success, gas 572,829 (higher than a
      renewal's ~360k, consistent with this being a FIRST write to this
      resolver — the receipt's first log is `Linked(recordId=1, node,
      name="autorenewdemo.eth")`, i.e. `_ensureRecord` creating the
      record, not just updating an existing one).
      PROOF, from a real contract event, not a guess or a second read-back
      call: decoded `AddressUpdated(recordId, coinType, addressBytes)`
      from the receipt's own log. First attempt at the ABI did not
      declare `recordId` as `indexed`, so `decodeEventLog` failed
      silently inside this script's own try/catch and nothing printed —
      caught by checking the log's raw topic0 against `cast keccak
      "AddressUpdated(uint256,uint256,bytes)"` (matched exactly, so the
      selector was never the problem) and then reading the real
      declaration, `IAddressSetter.sol:14`: `recordId` IS `indexed`. Fixed
      the ABI string, re-decoded the SAME already-mined log (no resend
      needed): `recordId=1, coinType=60, addressBytes=
      0xc1445f7062bdfc768baecfb8aa5b394e9c0da2f5` — exactly
      `FALLBACK_ADDRESS` from `.env`, exactly `coinType` 60 (ETH), on the
      first try at the value itself.
      Added `attemptFallback` to `operator/fallback.ts`: submits, waits
      for the receipt, and logs via the SAME `operator/log.ts` this item
      built for the renewal path, with `kind: "setAddress"` and
      DEMO-SCRIPT.md beat 5's exact success phrase, "permitted by the
      existing policy · no change requested".
      NOT WIRED: `attemptRenewal` (operator/attempt.ts) detects "funding
      source empty" and stops; nothing yet calls `attemptFallback`
      automatically when it does. That orchestration — one function
      deciding to call the other — belongs with whatever runs the
      operator's main loop (D8/D9's `node.ts`/`worker.ts`, which today
      only wire `core.ts` to a clock), not inside either leaf function,
      and was not built this beat. Named here rather than assumed done.
      O1 CHECKED OFF. All three of ERD.md 7.2's remaining steps are built
      and PROVEN, not just written: step 3 (submit) on the mock/fork and
      on live Sepolia (tx `0xa2ce0c94...`); step 4 (fallback) on live
      Sepolia (tx `0x1daf0755...`, this beat); step 5 (the attempt log)
      tested across four scenarios with every reason labelled by source.
      The orchestration gap above, and D10 itself, are what's left before
      the demo has a frontend.

- [ ] D10. GATED. Wire the right pane to real contract events and call results.
      2026-10-22: GATE MET (progress/contracts.md C1 passed), but BLOCKED
      for a reason the ledger does not anticipate: not done.
      "Wire the right pane to real contract events and call results"
      presumes those events and call results already exist somewhere to
      wire to. They do not. Checked before writing any UI code: `grep -rl
      "writeContract\|sendTransaction\|signTransaction\|walletClient\|
      SESSION_PRIVATE_KEY\|privateKeyToAccount" operator/ app/src/ config/`
      returns nothing. `operator/core.ts` (D7) only reads expiry and
      decides the window — ERD.md 7.2 steps 1-2. Steps 3-5 (submit with the
      session key, write the fallback address on a funding failure, record
      the attempt) were explicitly NOT built in D7, D8 or D9: each of those
      items' own notes say so, in the same words, e.g. D7's "Not done here,
      left for later items: building and submitting the renewal call...
      those need the contract change, still behind progress/contracts.md
      C1." That condition is now satisfied — C1 passed earlier this beat —
      but no ledger item actually claims steps 3-5. D10 through D13 are all
      about the FRONTEND (the right pane, the time scrubber, the drain
      control, the setup flow); none of them is "extend the operator to
      submit." `ERD.md` section 9's step 3, "Build the two panes against
      the operator log," presumes the operator log already contains real
      attempts — it does not yet, because nothing has ever called `renew`.
      Not improvising a fix in D10's place: building the submission path
      means writing code that loads `SESSION_PRIVATE_KEY` from `.env` and
      signs and sends a transaction (even against the local fork, under
      `AGENTS.md`'s existing hard rules 2/3 on which keys may never be
      used). That is a materially different, higher-stakes kind of change
      than anything D6-D9 did — all of which were deliberately read-only
      or local-process work — and every one of D7-D9's own notes already
      flagged signing/submission as deferred, not as this item's job. Per
      this file's rule for a blocked item: writing the problem here rather
      than deciding unilaterally to add a new "operator submit" item or to
      fold steps 3-5 into D10's scope.
      Options for whoever decides: (a) add an explicit ledger item for
      ERD.md 7.2 steps 3-5 (operator submit + fallback write + attempt
      record) ahead of D10, so D10 has a real log to wire to; (b) decide
      D10 itself is meant to include that operator work, and say so; (c)
      decide the demo's first pass can wire the right pane to a stub/mock
      attempt log instead of a real one, if that is an acceptable reading
      of "real contract events and call results" for this stage — not
      assumed here, since AGENTS.md hard rule 4 exists specifically to
      forbid exactly that kind of stand-in in the shipped frontend.
      D11, D12 and D13 are also GATED on the same C1 and read as depending
      on the same missing operator-submit path (a drain control and a
      setup flow both presuppose a live session the operator can act
      against), so this beat does not attempt to skip ahead to them.
      2026-10-27, continued, after O1: the blocking reason above is
      resolved — a real log now exists (`operator/attempts.log.jsonl` via
      `operator/log.ts`, built and tested in O1). Read `app/src/
      components/RightPane.tsx` (D6's static shell: session fields and an
      empty attempt table, exactly ERD.md 8.2's shape) before writing
      anything, and found a BLOCKING ARCHITECTURE QUESTION this item
      cannot resolve by reading more code, because it is a forward
      decision, not a fact about what exists.
      `DECISIONS.md` D2: "Vite keeps the demo a local application with no
      server." `app/package.json` already has `wagmi` and
      `@tanstack/react-query` installed, which fits a pure
      browser-queries-the-chain-directly design. That works cleanly for
      session info sourced from live state (e.g. "budget remaining" as
      the ERC-20 `allowance(owner, account)`, a direct on-chain read) and
      for a SUCCESSFUL attempt (a real tx the browser can look up by
      hash/event). It does NOT obviously work for a REJECTED attempt:
      `attemptRenewal`'s own design (O1) deliberately does NOT submit a
      doomed transaction — it pre-checks, then confirms via a read-only
      `isValidSignatureWithSender` call, specifically so a rejection costs
      no gas. That rejection leaves no on-chain trace for the browser to
      later discover by querying events; the only record is the line
      `operator/log.ts` wrote to a local JSONL file, which a browser
      cannot read directly, and D2 reads as ruling out a server to serve
      it over HTTP.
      Two ways to close this gap, named rather than picked: (a) the
      browser repeats the SAME read-only diagnostic itself, live, instead
      of trusting a file the operator wrote — this keeps "no server" but
      means the rejection-detection logic (knowing which input to push out
      of bounds, decoding `PolicyRuleFailed`) lives in two places instead
      of one, the exact kind of duplication this item has avoided all the
      way through; (b) Vite's dev server exposes the log over one small
      endpoint via its own plugin hooks, which is still "no deployed
      server" in the sense D2's reasoning seems to care about (no
      infrastructure, still `vite dev` locally) but IS literally a server
      in the sense D2's words say. Not choosing between these alone, the
      same discipline as every other open decision in this project —
      flagged to the manager instead.
      2026-10-27, continued, with the manager's decision: option (a), the
      browser runs the diagnostic itself, live. D2 stands, no server.
      JSONL log demoted to clearly-labelled history, not evidence for the
      live beat. Built the "one module, two callers" split the manager
      asked for, same pattern C4 used for session.ts:
      `operator/diagnostic.ts` — `buildDiagnosticReadArgs` (the exact call
      shape a Node `publicClient.readContract` AND a wagmi
      `useReadContract` hook both accept, so it is spread into either, not
      copied), `decodeRevertSelector`, `classifyExpectedRejection`,
      `POLICY_RULE_FAILED_SELECTOR`. Refactored `operator/attempt.ts`'s
      own `confirmViaValidator` to call into it instead of keeping a
      private copy of the ABI/selector-decoding logic; reran the
      four-scenario mock-fork suite after, identical results, confirming
      the refactor changed nothing behavioral.
      Started the browser side: `app/src/lib/wagmi.ts` (wagmi 3.7.9 config,
      chain metadata from `viem/chains` by `VITE_CHAIN_ID`, RPC from
      `VITE_RPC_URL` — never a secret, per `app/.env.example`'s own
      warning), wrapped `App.tsx` in `WagmiProvider` +
      `QueryClientProvider` (react-query, already a dependency, not
      added). `npx tsc --noEmit -p app/tsconfig.app.json` clean.
      BLOCKED ON A NEW QUESTION, surfaced rather than guessed past: a
      MEANINGFUL diagnostic call needs a VALIDLY SIGNED envelope — an
      empty or garbage signature fails validation before it ever reaches
      the duration/spend/owner policy check the demo wants to show live.
      Building that envelope (`session.ts`'s `buildRenewSessionProof` and
      friends, which the manager noted import cleanly into the browser)
      needs the session key and the owner key. `app/.env.example`'s own
      text: "DANGER: Vite inlines every VITE_* variable into the built
      bundle... Never put a private key, a mnemonic or an API secret in
      this file." So the root `.env`'s throwaway `SESSION_PRIVATE_KEY`/
      `DEPLOYER_PRIVATE_KEY` cannot go into the browser the way
      `VITE_RPC_URL` does, by this project's own stated rule, not a
      guess. D13 ("Setup flow: two signatures, no transaction") is
      probably where this gets resolved for real — a wallet-connected
      owner signature plus a session key generated fresh in the browser,
      never touching `.env` — but D13 has not been built, and D10 cannot
      wire a live beat to a signed envelope that does not yet have a
      safe way to get signed. Not assuming an answer (e.g., quietly
      putting a private key in `app/.env`, which the project's own
      example file explicitly warns against) — flagged instead.

- [ ] D11. GATED. Time scrubber control.
- [ ] D12. GATED. Drain control and the fallback beat.
- [ ] D13. GATED. Setup flow: two signatures, no transaction, fallback choice.
