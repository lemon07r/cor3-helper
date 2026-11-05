# COR3 Helper Unified — Changelog & Architecture Notes

## Overview

COR3 Helper Unified combines the latest game features from **SaltApocalypse** (`v1.8.5-salta.1`), the Firefox MV3 manifest strategy from **3ncy** (`v1.6.1`), and targeted solver robustness improvements inspired by **Nightingale** (`af3c9dd`), unified under an opt-in, fail-closed safety model.

## Sourced Upstream & Fork Changes

### 1. Firefox MV3 Architecture (adapted from 3ncy & custom adapter)
- **Manifest Architecture**: Replaced Chrome-specific `background.service_worker` with Firefox MV3 `background.scripts` (`console-logger.js`, `errors.js`, `background.js`).
- **Feature Detection & SidePanel Guarding**: Removed Chrome-only `sidePanel` manifest declarations and guarded `chrome.sidePanel` button in `popup/panel-controls.js` to degrade gracefully on Firefox.
- **Gecko Identity**: Added unique Gecko ID `cor3-helper-unified@lr7.local` and restricted web-accessible resources to COR3 origins (`https://cor3.gg/*`, `https://os.cor3.gg/*`).
- **Background Banner Cleanup**: Stripped Chrome `importScripts` banner from the bundled Firefox background script to avoid runtime evaluation conflicts in page contexts.

### 2. Safe Job Acceptance & Fail-Closed Eligibility (Phase 2)
- **Pure Eligibility Engine**: Implemented `src/shared/job-eligibility.js` with comprehensive checks for:
  - Malformed or corrupted job/server descriptors (fail-closed -> `unknown`).
  - Already accepted/signed jobs (prevents duplicate pledges -> `ineligible`).
  - Job deadline expiration safety buffer (rejects jobs expiring < 60s -> `ineligible`).
  - Cash reserve protection (prevents deposits that drop credits below configured reserve -> `ineligible`).
  - Intermediate transit hop hackability (e.g. S4L1 behind E1SCP: verifies required hack power on intermediate hops -> `ineligible`).
  - Server maintenance along full path (blocks jobs on servers in maintenance -> `ineligible`).
  - Access Grant vs Access Acquisition distinction (Access Grant requires manual review instead of falsely failing pre-sign login -> `manual-review`).
  - PSU power supply and boot checks (fails if hardware combination cannot boot or exceeds PSU wattage -> `ineligible`).
- **Dry Run Mode**: Built-in opt-in dry-run evaluation toggle (default: active/safe) to inspect job viability and reasons without signing or paying deposits.
- **Unit Test Suite**: 13 unit test scenarios validating all cases in `tests/eligibility_cases.json`.

### 3. Multi-Combo Loadout Resolver & Purchase Suggestions (Phase 3)
- **Multi-Combination Optimizer**: Sourced and enhanced Nightingale's `findBestSoftwareLoadout` to iterate over all compatible software candidates and find the bootable owned hardware configuration that yields the highest power for the target ability.
- **Hardware Identity Checking**: Added `hardwareMatches(currentHw, targetHw)` to avoid unnecessary hardware swaps.
- **Separation of Owned vs Catalog Upgrades**: Implemented `resolveLoadoutRequirement` and `findCheapestMissingHardware`:
  - `achievableWithOwned`: Computes the exact power achievable with currently owned gear.
  - `cheapestMissingPurchases`: When owned hardware cannot reach the required power, evaluates market catalog hardware and reports the cheapest missing upgrade(s) without auto-purchasing.
- **Static Reference Sanity Checks**: Verified against `references/PDF_NOTES.md` and `references/CURRENT_USER_SCENARIO.md` across 8 unit test cases (Cypher+ 11 to 20, Porter-lite 8 to 17, PSU constraints, missing component recommendations).

### 4. Preservation of Modern Salt Features & Robustness (Phase 4)
- **Retained Salt Modules**: Mailbox auto-claim (`mail.js`), Drone mission tracking (`drone.js`), Warehouse stash sorting (`stash-sort.js`), and Mercenary insurance/cost limiters (`auto-send.js`).
- **Safe DOM Practices**: Addressed Mozilla review warnings regarding `innerHTML`. Converted element modifications to safe DOM methods (`replaceChildren`, DOM text nodes).
- **Opt-In Automation**: All irreversible or paid automation (auto-jobs, auto-send mercs, auto-sell) remains disabled by default.

## Known Limitations

- **Temporary Installation**: Temporary Firefox installation via `about:debugging` unloads upon browser restart; permanent installation requires Mozilla signing or developer builds with signature checks disabled.
- **Live WebSocket Runtime**: WebSocket message passing depends on Firefox page-script execution in `world: MAIN`; live server interaction requires active game login on cor3.gg.
