# Concordium × BillSettle — Status (for AGY)

Updated: 15 Nov 2026 ~19:45 Bangkok. Source of truth: `concordium/INTEGRATION_PLAN.md` (Thai, steps 0–6).

## What is done
- **Registered NATIVE on Concordium testnet — 15 Nov 2026 19:12:48 Bangkok.**
  - Agent **#1185**, Token **#1185**, status **Active**, type **Native**, contract **CIS-8004 #12802** (the 12756 vs 12802 conflict is resolved — native uses 12802).
  - Badge (short): `JyP9WvdiYC2ADhyQTirr5`
  - Badge (full CAIP-19): `ccd:4221332d34e1694168c2a0c0b3fd0f27/cis-2:JyP9WvdiYC2ADhyQTirr5`
  - Owner: `3fFCiJ13LTXL9j2GaNAAMq5C3xMNpcdQGTyt6VgkCkxjz1SKW9`
  - Tx: `8d81b6b70c22a92e2c3590906586ea0d8256f629139b1126771571d504e2bb0e` (block 50843126, SUCCESS), fee 15.699899 CCD. Balance now 19,984.300101 CCD (was 20,000).
  - On-chain token id (hex): `a104000000000000`, supply 1.
  - Links: [tx on CCDScan](https://testnet.ccdscan.io/?dcount=2&dentity=transaction&dhash=8d81b6b70c22a92e2c3590906586ea0d8256f629139b1126771571d504e2bb0e) · [token](https://testnet.ccdscan.io/?dcount=1&dentity=token&did=a104000000000000&dcontractAddressIndex=12802&dcontractAddressSubIndex=0) · [CCDExplorer](https://ccdexplorer.io/testnet/transaction/8d81b6b70c22a92e2c3590906586ea0d8256f629139b1126771571d504e2bb0e) · [registry dashboard](https://testnet-agent-registry.concordium.com/dashboard)
- **Decision (sydear, 15 Nov 19:07): NO NEAR in the registration.** Native model A only, no MCP, no CIS-8. NEAR stays the bill-payment rail only (contracts NOT modified).
- **Agent Card JSON audited & fixed (`docs/.well-known/agent-card.json` + `.gitattributes` LF rule):**
  - Updated via Concordium Registry MCP `build_agent_badge` so it passes `extension_conformant`, `verification_present`, `contracts_match`, and `verify_url_matches`:
    - Added `params.agentWallet` (`ccd:4221332d34e1694168c2a0c0b3fd0f27:3fFCiJ13LTXL9j2GaNAAMq5C3xMNpcdQGTyt6VgkCkxjz1SKW9`)
    - Added `params.contracts.cis8` (`ccd:4221332d34e1694168c2a0c0b3fd0f27:12801.0`)
    - Normalized `params.verify` string (`Resolve tokenAddress via CIS-8004 agent_of; confirm owner + status=Active + card SHA-256 == metadata_hash.`)
    - Normalized `params.verification.verifyUrl` to `https://agent-registry-mcp.concordium.com/v1/badge-check/JyP9WvdiYC2ADhyQTirr5` (confirmed live! Auto-detects testnet from the token address and serves `access-control-allow-origin: *`).
  - Canonical SHA-256 (`metadata_hash_hex`): `04d2a1e670408ff3b0319be22c367356f1fac6541b317a3775fea61e2fd455fb` (3,571 bytes, UTF-8 LF).
- **BillSettle UI & Live `verifyBadge()` + On-Chain `setAgentURI` Signer (`docs/index.html`, `docs/app.js`, `docs/wc-bundle.js`):**
  - Added "Verified by Concordium" badge + short badge string `JyP9WvdiYC2ADhyQTirr5` + live status pill in the header, dashboard card, and every bill receipt (with CCDExplorer + CCDScan + NEAR Explorer links).
  - Because `testnet-agent-registry.concordium.com` does not expose a UI button for `setAgentURI`, added an **"Anchor Agent Card On-Chain (`setAgentURI`)"** signing drawer directly on the BillSettle dashboard supporting both **Mobile Wallet (WalletConnect QR)** and **Browser Wallet (Extension)** via `/v1/build-set-agent-uri/JyP9WvdiYC2ADhyQTirr5`.
- **Project created on Encode Club** ("BillSettle", solo, join code 8743a80a, expires 22 Nov 18:04). Checkpoint 1 deadline 23 Nov 06:59 already satisfied.

## What is next (sydear / AGY)
1. **Sign `setAgentURI` (sydear on phone / wallet):**
   - Open https://techfrontiers.github.io/billsettle/
   - In the **Verified by Concordium** card, click **"Sign with Mobile Wallet (QR)"** (or **"Sign with Browser Wallet"**).
   - Scan the QR code with Concordium Mobile Wallet (testnet), approve WalletConnect pairing, and approve the `CIS-8004.setAgentURI` transaction on your phone.
   - Wait ~10–15 seconds for finality — the UI automatically polls `verifyBadge()` until `badge_valid: true` and `SHA-256 Match` turn green!
2. **Confirm live `badge-check`:** `GET https://agent-registry-mcp.concordium.com/v1/badge-check/JyP9WvdiYC2ADhyQTirr5` returns `badge_valid: true`, `extension_conformant: true`, `verification_present: true`, `issues: []`.
3. **Demo video ≤3 min + submission** by 10 Dec 2026 06:59 Bangkok. x402 payments = stretch/droppable (badge + registry alone satisfy "meaningful use").
4. **Workshops:** Mon 16 Nov 22:00 + Tue 18 Nov 22:00 Bangkok (optional check-in / x402 clarification).

## Open / watch
- `verifyUrl` (`https://agent-registry-mcp.concordium.com/v1/badge-check/JyP9WvdiYC2ADhyQTirr5`) was tested live 15 Nov and is operational with CORS (`*`).
- Do NOT use mainnet contract numbers (CIS-8004 mainnet 10082) on testnet. Testnet only.
- NEAR Hackathon (BillSettle submitted 13 Nov) results are due 19 Nov 06:59 — **separate work, do not mix with this Concordium track.**

## Key accounts (testnet only)
- Concordium owner: `3fFCiJ13LTXL9j2GaNAAMq5C3xMNpcdQGTyt6VgkCkxjz1SKW9`
- NEAR bills contract: `billsettle-bills.testnet` · token: `billsettle-token.testnet` (BSDD) · shop: `billsettle-shop.testnet`
- Repo: https://github.com/Techfrontiers/billsettle · Demo: https://techfrontiers.github.io/billsettle/
