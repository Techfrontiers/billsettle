# Concordium × BillSettle — Status (for AGY)

Updated: 15 Nov 2026 ~19:25 Bangkok. Source of truth: `concordium/INTEGRATION_PLAN.md` (Thai, steps 0–6).

## What is done
- **Registered NATIVE on Concordium testnet — 15 Nov 2026 19:12:48 Bangkok.**
  - Agent **#1185**, Token **#1185**, status **Active**, type **Native**, contract **CIS-8004 #12802** (the 12756 vs 12802 conflict is resolved — native uses 12802).
  - Badge (short): `JyP9WvdiYC2ADhyQTirr5`
  - Badge (full CAIP-19): `ccd:4221332d34e1694168c2a0c0b3fd0f27/cis-2:JyP9WvdiYC2ADhyQTirr5`
  - Owner: `3fFCiJ13LTXL9j2GaNAAMq5C3xMNpcdQGTyt6VgkCkxjz1SKW9`
  - Tx: `8d81b6b70c22a92e2c3590906586ea0d8256f629139b1126771571d504e2bb0e` (block 50843126, SUCCESS), fee 15.699899 CCD. Balance now 19,984.300101 CCD (was 20,000).
  - On-chain token id (hex): `a104000000000000`, supply 1.
  - Links: [tx on CCDScan](https://testnet.ccdscan.io/?dcount=2&dentity=transaction&dhash=8d81b6b70c22a92e2c3590906586ea0d8256f629139b1126771571d504e2bb0e) · [token](https://testnet.ccdscan.io/?dcount=1&dentity=token&did=a104000000000000&dcontractAddressIndex=12802&dcontractAddressSubIndex=0) · [registry dashboard](https://testnet-agent-registry.concordium.com/dashboard)
- **Decision (sydear, 15 Nov 19:07): NO NEAR in the registration.** Native model A only, no MCP, no CIS-8. NEAR stays the bill-payment rail only (contracts NOT modified).
- **Agent Card JSON written** (this push): `docs/.well-known/agent-card.json` + empty `docs/.nojekyll` so GitHub Pages serves it. Card values are filled from the registration above.
- **Project created on Encode Club** ("BillSettle", solo, join code 8743a80a, expires 22 Nov 18:04). Checkpoint 1 deadline 23 Nov 06:59 already satisfied.

## What is next (AGY)
1. **Verify the Agent Card** against the badge-check requirements (badge_valid + extension_conformant + verification_present). Fix any field the checker needs.
2. **Pin the card on-chain:** compute SHA-256 of the card as served (`curl -s https://techfrontiers.github.io/billsettle/.well-known/agent-card.json | sha256sum`), then `setAgentURI` (via MCP `build-set-agent-uri` or the Registry app). This needs the user's signing — the approval prompt may appear on his **phone (Mobile Wallet)**, not in the browser. Then the name "BillSettle" will show on-chain (right now the dashboard shows name "—" and Metadata URL: N/A).
3. **Badge in the BillSettle UI** (`docs/index.html` + `docs/app.js`): live `verifyBadge()` via the MCP badge-check REST endpoint, showing the "Verified by Concordium" badge.
4. **Demo video ≤3 min + submission** by 10 Dec 2026 06:59 Bangkok. x402 payments = stretch/droppable (badge + registry alone satisfy "meaningful use").
5. **Workshops:** Mon 16 Nov 22:00 + Tue 18 Nov 22:00 Bangkok. Confirm the badge-check testnet endpoint at the workshop.

## Open / watch
- `verifyUrl` in the card is the expected endpoint but **unconfirmed** — verify at the workshop before relying on it.
- Metadata hash discrepancy (dashboard Technical view `0x2d49…` matches the tx; Simple view `0x1c1e…` differs) — unresolved, re-check when pinning the card.
- Do NOT use mainnet contract numbers (CIS-8004 mainnet 10082) on testnet. Testnet only.
- NEAR Hackathon (BillSettle submitted 13 Nov) results are due 19 Nov 06:59 — **separate work, do not mix with this Concordium track.**

## Key accounts (testnet only)
- Concordium owner: `3fFCiJ13LTXL9j2GaNAAMq5C3xMNpcdQGTyt6VgkCkxjz1SKW9`
- NEAR bills contract: `billsettle-bills.testnet` · token: `billsettle-token.testnet` (BSDD) · shop: `billsettle-shop.testnet`
- Repo: https://github.com/Techfrontiers/billsettle · Demo: https://techfrontiers.github.io/billsettle/
