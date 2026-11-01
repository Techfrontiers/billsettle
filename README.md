# BillSettle — small-shop bills, paid and receipted on NEAR

**NEAR Hackathon: Build Beyond Boundaries — Real-World Money track.**
Solo entry. Build window Nov 1–14, 2026. Submission due Nov 15, 06:59 Bangkok
(single submission, cannot be edited after sending).

## Problem

Small shops issue bills in chat or on paper, and payment happens off-record
(bank slips in chat). There is no single trustworthy record linking
bill ↔ payment ↔ receipt — so "paid or not yet?" disputes mean scrolling chat.

## Demo (2-week solo scope)

1. Shop creates a bill (items + amounts) → bill page + QR.
2. Customer pays with stablecoin via NEAR (testnet demo).
3. On-chain confirmation flips the bill to **paid** + receipt with tx hash.
4. Shop dashboard lists bills by status.

**Scope cuts (deliberate): ONE bill flow, ONE stablecoin, testnet demo.
NO payroll, NO remittance, NO marketplace.**

## Status — slice 3 (Nov 1, 2026, deployed to NEAR TESTNET)

- Bills contract: **billsettle-bills.testnet**
  (deploy tx `7iQUnbvSvQ7iTdf4iBKTmV2eNbmhSnuoQjiFdxRj6k8e`).
- Token contract (BSDD, mock NEP-141, 6 decimals): **billsettle-token.testnet**
  (deploy tx `47MHQE5JkHQSKZ87wyt7C6X1AaukaYmU41MwM3kCnDdT`).
- Demo accounts (throwaway, testnet only): shop `billsettle-shop.testnet`,
  customer `billsettle-customer.testnet`.
- Full on-chain pay flow verified: shop created bill B1 (620 BSDD) →
  customer paid via `ft_transfer_call` (msg `B1`) → bill flipped to **Paid**,
  payer recorded, bills contract holds exactly 620,000,000 units, customer
  balance exactly 10,000,000,000 − 620,000,000 = 9,380,000,000.
  Payment tx: `9fxsLpNoP1LFPwMMnjZjdqWqZejvtxB3AJxocZDXr9ge`
  (https://explorer.testnet.near.org/transactions/9fxsLpNoP1LFPwMMnjZjdqWqZejvtxB3AJxocZDXr9ge).
- Second demo bill B2 (430 BSDD) left **Unpaid** for visitors to pay.
- Frontend: `docs/` (dashboard by status + bill page + QR + receipt),
  hosted on GitHub Pages — see Demo below.
- NOT yet built: in-browser wallet signing on the demo page (page is
  view-only for now; pay flow is proven on-chain + documented below),
  demo video, X post (his), submission (his, late before Nov 15 06:59 Bangkok).

## Demo

Live demo: https://techfrontiers.github.io/billsettle/

Do X → see Y (all on NEAR testnet, no real money):

1. Open the demo → dashboard shows B1 **Paid** and B2 **Unpaid**
   (live `list_bills` view calls, no wallet needed).
2. Click B1 → bill page shows items, total 620 BSDD, status Paid,
   payer `billsettle-customer.testnet`, and the receipt with the
   payment transaction link.
3. Click B2 → bill page shows items, total 430 BSDD, status Unpaid,
   and a QR code linking back to that bill page.
4. Pay B2 from a testnet wallet: call `ft_transfer_call` on
   `billsettle-token.testnet` with `receiver_id` =
   `billsettle-bills.testnet`, `amount` = `"430000000"`, `msg` = `"B2"`
   (1 yoctoNEAR deposit, ≥30 TGas) → reload the dashboard and B2
   shows **Paid**.
5. Shop-side (operator, CLI): create a bill with
   `create_bill` on `billsettle-bills.testnet` signed as the shop
   account, then it appears on the dashboard.

## Status — slice 2 (Nov 1, 2026, built on the NexNodo box)

- Contract compiles + **5/5 unit tests pass, zero warnings**.
- Wasm artifact: `target/wasm32-unknown-unknown/release/billsettle.wasm`
  (307,920 bytes, built Nov 1, 2026 on the box).
- SDK: near-sdk **5.30.0** (pinned exact in `contract/Cargo.toml`).
  The 4.x line was abandoned: its `parity-secp256k1 0.7.0` dependency is
  yanked, so no fresh 4.1.1 build can resolve. `Cargo.lock` is committed so
  the exact tree that compiled is reproducible.
- NOT yet built: testnet deploy, pay-flow frontend, QR page, dashboard,
  hosted demo, video.

## Contract methods (`contract/src/lib.rs`, near-sdk 5.30.0)

| Method | Type | What it does |
|---|---|---|
| `new(shop, ft_contract)` | init | Sets the shop account + the stablecoin contract |
| `create_bill(id, items, total)` | call, shop only | Creates an unpaid bill; total must equal item sum |
| `get_bill(id)` | view | One bill by id |
| `list_bills(status?, from_index, limit)` | view | Bills for the dashboard, optionally by status |
| `ft_on_transfer(sender, amount, msg)` | NEP-141 receiver | Stablecoin contract calls this on `ft_transfer_call`; `msg` = bill id; exact payment flips the bill to Paid, returns 0 (no refund) |

Two facts that shape the frontend:

- **The contract cannot read its own tx hash.** The receipt's tx hash comes
  from the client's `ft_transfer_call` transaction — the frontend records it
  and shows it on the receipt. The contract records payer + amount + timestamp.
- **`ft_on_transfer` must NOT be `#[private]`.** That attribute only allows
  calls from the contract itself, but this method is called by the stablecoin
  contract. Access control is the assert: predecessor must be `ft_contract`.

## Testnet funding — checked Nov 1, 2026 (decision)

- **Testnet NEAR (gas):** free via the standard testnet faucet / testnet
  wallet flow. Unblocked (not live-tested tonight).
- **Testnet USDC on NEAR:** the contract exists in Circle's docs
  (testnet `3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af`),
  but **no confirmed faucet channel for it was found tonight** — Circle's
  faucet coverage lists do not mention NEAR. A manual check of
  faucet.circle.com's network dropdown would settle it definitively.
- **Decision (default): demo pays with our own mock NEP-141 stablecoin on
  testnet** (deploy + mint to demo accounts). The transfer flow is identical
  to USDC (`ft_transfer_call` → `ft_on_transfer`), so the demo is a real
  on-chain payment either way. If Circle faucet access for NEAR is confirmed,
  swap one address: set `ft_contract` to the real testnet USDC contract above.

## Build (on the box, Rust 1.99.1)

```sh
cd contract
cargo test                                          # unit tests (needs the
                                                    # [dev-dependencies] unit-testing feature)
cargo build --target wasm32-unknown-unknown --release
```

Notes from the build:

- near-sdk 5.x **refuses a plain `cargo build`/`cargo check`** (compile guard
  in its lib) — always pass the wasm target, or use `cargo near build`.
- `store::IterableMap` is the current iterable map (`UnorderedMap` is
  deprecated in 5.30.0 for iteration performance; nothing is deployed yet,
  so no storage migration is involved).
- The wasm artifact is NOT committed to git (see `.gitignore`); rebuild it
  from `contract/` any time.

Deploy + call flow (testnet) lands in slice 3.

## Disclosure (for the submission)

- Built in-window (Nov 1–14, 2026). No code from before the announcement
  (Oct 19, 2026) is part of this repo.
- Inspired by the author's delivery-note app idea — this is a NEW prototype,
  not a resubmission of that app.
- Testnet-only demo. No mainnet funds, no real payments.
