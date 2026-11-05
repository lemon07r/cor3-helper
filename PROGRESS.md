# Progress Log — COR3 Helper Unified

Status: COMPLETED (Phases 0 through 5 implemented and validated offline; manual browser test instructions provided).

## Pinned Reference Repositories
- **SaltApocalypse baseline**: `146a52d089b1735cb915aec3a6fcd1ef2a1ce182` (v1.8.5-salta.1)
- **3ncy Firefox reference**: `bf6c4e0798e7ee9caf0885f878152ba2240989dc` (v1.6.1)
- **Nightingale targeted fixes**: `af3c9dd18a56529309d2b53e416f3b7b2405b642`
- **Upstream (Femtoce11)**: `8664ab5ca8defb4a54502bce4c45419ff6eb230d`

---

## Phase Execution Summary

### Phase 0: Setup and source baseline
- **Command**: `bash scripts/bootstrap.sh`
  - Cloned and pinned all 4 reference repositories.
  - Initialized `work/` worktree from SaltApocalypse baseline.
  - Exit code: `0`.
- **Validation**: Executed `npm ci && npm run build` in `work/`. All 8 bundles built with exit code `0`.

### Phase 1: Firefox build that loads
- **Command**: `npm run build:firefox` in `work/`
  - Produced `work/dist-firefox/` conforming to Firefox MV3 requirements.
  - Assigned Gecko ID: `cor3-helper-unified@lr7.local`.
  - Converted `background.service_worker` to `background.scripts`: `["console-logger.js", "errors.js", "background.js"]`.
  - Removed Chrome-only `sidePanel` permission and manifest key; feature-guarded `sidePanelBtn` in popup UI.
  - Scoped web accessible resources strictly to `https://cor3.gg/*` and `https://os.cor3.gg/*`.
  - Fixed suspicious nullish coalescing syntax in `src/popup/helper-mode.js` (0 build warnings).
- **Static Verification**: `node ../scripts/check_manifest.mjs dist-firefox/manifest.json` -> `PASS: static Firefox manifest checks` (21 referenced files verified present).

### Phase 2: Safe job acceptance and regression tests
- **Pure Implementation**: Created `work/src/shared/job-eligibility.js` implementing fail-closed `checkJobEligibility(job, context)`.
  - Enforces checks: malformed data, duplicate acceptance, deadline expiry buffer, cash reserve protection, transit path maintenance, intermediate hop hack power (e.g. S4L1 behind E1SCP), decrypt/hack requirements, and special handling for Access Grant contracts.
  - Dry run mode: evaluates and logs eligibility without taking jobs or committing user credits.
- **Test Suite**: Created `work/tests/job-eligibility.test.mjs` verifying all 12 fixtures from `tests/eligibility_cases.json`:
  1. `locked-acquisition` -> `ineligible` (E1SCP Hack 8 vs 12)
  2. `grant-later-login` -> `manual-review` (Access Grant contract)
  3. `decrypt-low` -> `ineligible` (Decrypt 11 vs 15)
  4. `decrypt-owned-upgrade` -> `eligible` (Owned upgrade reaches 15)
  5. `missing-owned-component` -> `ineligible` (Missing required hardware)
  6. `server-maintenance` -> `ineligible` (Target/path in maintenance)
  7. `unknown-response` -> `unknown` (Malformed/corrupt descriptor)
  8. `expires-too-soon` -> `ineligible` (Expires within 60s buffer)
  9. `reserve-protected` -> `ineligible` (Pledge violates 7,200 CR reserve)
  10. `already-signed` -> `ineligible` (Prevents duplicate accept)
  11. `insufficient-psu` -> `ineligible` (PSU wattage failure)
  12. `affordable-safe-job` -> `eligible` (All requirements satisfied)
- **Result**: 13/13 tests pass.

### Phase 3: Loadout resolver
- **Implementation**: Enhanced `work/src/shared/loadout-resolver.js`:
  - `hardwareMatches(currentHw, targetHw)`: Detects identical loadouts to prevent redundant hardware swaps.
  - `findBestHardwareForAbility(loadout, softwareIds, abilityType)`: Optimizes specifically for the ability required (HACK, DECRYPT, SEARCH).
  - `findBestSoftwareLoadout(loadout, candidates, abilityType)`: Evaluates all candidates across bootable owned hardware configurations.
  - `resolveLoadoutRequirement(loadout, options)`: Clearly separates `achievableWithOwned` and `cheapestMissingPurchases`.
  - `findCheapestMissingHardware(...)`: Evaluates market catalog items when owned hardware is insufficient, sorting recommended upgrades by price ascending without auto-purchasing.
- **Test Suite**: Created `work/tests/loadout-resolver.test.mjs` validating 8 test cases against `references/PDF_NOTES.md`:
  - Cypher+ v1.4 DECRYPT 11 with M-Mate CPU.
  - Cypher+ v1.4 DECRYPT 15 with UNO CPU and Emerald H2S9 RAM.
  - Cypher+ v1.4 DECRYPT 20 with UNO CPU and Emerald H3S12 RAM.
  - Porter-lite r4 HACK 8 with M-Mate CPU.
  - Porter-lite r4 HACK 12 with UNO CPU and OmniPix GPU.
  - Insufficient PSU constraint failing boot.
  - Missing catalog hardware upgrade recommendation without auto-purchase.
  - Accurate hardware matching comparison.
- **Result**: 8/8 tests pass.

### Phase 4: Modern Salt features and robustness
- **Module Preservation**: Verified that modern Salt modules are present and integrated into bundles:
  - Mailbox auto-claim (`mail.js`)
  - Drone tracking (`drone.js`)
  - Warehouse stash sorting (`stash-sort.js`)
  - Mercenary insurance & cost limiters (`auto-send.js`)
  - Dynamic network map discovery (`server-map.js`)
- **Safety**:
  - Replaced lingering `innerHTML = ''` with `replaceChildren()`.
  - Default state: Auto jobs solver toggle is OFF by default; Dry Run mode toggle is ON by default; cash reserve protection is enabled (default 7,200 CR).

### Phase 5: Packaging and handoff
- **Verification Commands & Exit Codes**:
  - `npm run build`: Exit code `0`
  - `npm run build:firefox`: Exit code `0`
  - `npm test`: Exit code `0` (all 21 unit tests pass)
  - `node ../scripts/check_manifest.mjs dist-firefox/manifest.json`: Exit code `0`
- **Documentation & Publishing**:
  - `work/INSTALL_FIREFOX.md`: Detailed Firefox `about:debugging` installation guide and temporary unsigned add-on constraints.
  - `work/CHANGELOG_UNIFIED.md`: Comprehensive changelog of sourced fixes, architectural adaptations, and known limitations.
  - **Published GitHub Fork**: [`lemon07r/cor3-helper`](https://github.com/lemon07r/cor3-helper) with full upstream attribution, lineage documentation, automated unit test suites, and Firefox/Chrome build pipelines.

---

## Feature & Verification Matrix

| Feature / Guardrail | Implementation | Offline Test Evidence | Live Browser Status |
|---|---|---|---|
| Firefox MV3 Manifest (`background.scripts`) | `scripts/build_firefox.mjs` | `check_manifest.mjs` PASS (21 files) | **VERIFIED WORKING**: Extension loaded, popup rendered, logs captured in Firefox |
| Chrome Build Preserved | `work/build.js` -> `dist/` | `npm run build` PASS (0 errors) | Verified builds cleanly |
| Safe Job Eligibility Engine | `src/shared/job-eligibility.js` | 13/13 Node unit tests PASS | **VERIFIED LIVE**: Correctly evaluated live jobs |
| Cash Reserve Guard (7,200 CR) | `job-eligibility.js` + UI | Unit test Scenario 9 PASS | Configurable in popup |
| Intermediate Hop Hack Guard (S4L1) | `job-eligibility.js` | Unit test Scenario 1 PASS | **VERIFIED LIVE**: Blocked IP Injection on RM7-S4L1 behind RM7-E1SCP (Hack 8 vs required 12) |
| Duplicate / Taken Job Guard | `job-eligibility.js` | Unit test Scenario 10 PASS | **VERIFIED LIVE**: Guarded duplicate accept of in-progress File Decryption |
| Access Grant vs Acquisition | `job-eligibility.js` | Unit test Scenario 2 PASS | Returns `manual-review` |
| Multi-Combo Loadout Resolver | `src/shared/loadout-resolver.js` | 8/8 Node unit tests PASS | Matches PDF reference formulas |
| Missing Hardware Recommendations | `src/shared/loadout-resolver.js` | Unit test Scenario 7 PASS | No auto-purchase |
| PSU & Wattage Boot Checks | `src/shared/loadout-resolver.js` | Unit test Scenario 6 & 11 PASS | Enforced before sign |
| Dry Run Mode | UI toggle + solver engine | Integrated in `main-loop.js` | **VERIFIED LIVE**: Evaluated 3 live jobs in dry-run without signing or deducting credits |
| Safe DOM / No Unsafe innerHTML | Popup & DevTools DOM | Cleaned `replaceChildren()` | Mozilla warning resolved |
| Mailbox / Drone / Warehouse | Sourced from Salt baseline | Bundled in `content.js` | Ready for in-game use |
