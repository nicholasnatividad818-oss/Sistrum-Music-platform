# Bitcoin Release Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Offer one configured release through hosted BTCPay with manual fulfillment.
**Architecture:** A validated public configuration drives a conditional React panel in track details. BTCPay handles payments outside Sistrum; operator verifies settlement before fulfillment.
**Tech Stack:** React, TypeScript, Vite, Node tests, esbuild.
**Spec:** docs/superpowers/specs/2026-11-20-bitcoin-pilot-design.md

## Global Constraints
No wallet private keys, payment API credentials or paid download URLs in browser code. No automatic access grant. Hide unconfigured checkout.

## Review Focus
Incomplete config hides panel; wrong release hides panel; unsafe URLs fail closed; price and support details remain text; no return URL grants access.

### Task 1: Conditional Bitcoin checkout
**Files:** src/services/bitcoinCheckout.ts, src/components/BitcoinPurchasePanel.tsx, src/components/TrackDetailView.tsx, tests/bitcoin-checkout.test.mjs, .env.example, docs/bitcoin-pilot.md.
**Interfaces:** getBitcoinCheckout(trackId, env) returns validated checkout or null; BitcoinPurchasePanel consumes trackId and optional env for rendering tests.
- [ ] Write tests for complete config, missing fields, release mismatch, HTTPS restrictions, credentials in URLs, rendered manual delivery copy and absent unlock.
- [ ] Run tests and observe missing implementation failure.
- [ ] Implement config validation and panel; wire into track detail.
- [ ] Document configuration, store setup, private delivery and settlement checks.
- [ ] Run focused tests and npm run check, review diff, commit and push feature branch.
- [ ] Publish only with actual checkout and deployment access; verify live purchase path without claiming a simulated payment is real.

### WalletConnect extension
- [x] Add official Ethereum provider and public project configuration; no transaction/signing permissions requested.
- [x] Add optional connection UI with account/chain/disconnect updates and cancellation handling.
- [x] Add config, account, rendering and late-session cleanup regression tests.
- [x] Forward public configuration through Docker and Cloud Build.
- [x] Independent review found a pending-pairing cleanup issue; regression failed before fix and passes after fix.
- [x] Final npm run check: TypeScript passed, 52 tests passed, production build passed. Repository push follows this verification.

Ruling: Ethereum mainnet connection is separate from Bitcoin payment processing; no purchase or login is inferred from a wallet session. This avoids claiming unsupported Bitcoin checkout through the Ethereum provider. Live pairing requires a real public Reown project ID; no fabricated identifier is saved. User requested publishing, but no deployment credentials or actual BTCPay release checkout are available, so only repository publication can be completed here.
