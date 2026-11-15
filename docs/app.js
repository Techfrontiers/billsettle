// BillSettle demo frontend — view-only by default, with optional in-browser
// NEAR testnet wallet signing (Meteor-first via Wallet Selector v10 CDN ESM).
// Reads live on-chain data from NEAR testnet via raw JSON-RPC.
// Paying an unpaid bill signs ft_transfer_call on billsettle-token.testnet,
// verifies Paid status on-chain via get_bill, and stores the real tx hash.
"use strict";

var BILLS_CONTRACT = "billsettle-bills.testnet";
var TOKEN_CONTRACT = "billsettle-token.testnet";
var SHOP_ACCOUNT = "billsettle-shop.testnet";
var RPC_URLS = [
  "https://test.rpc.fastnear.com",
  "https://rpc.testnet.near.org",
];
var EXPLORER = "https://explorer.testnet.near.org";

var WALLET_CDN = {
  core: "https://cdn.jsdelivr.net/npm/@near-wallet-selector/core@10.1.4/+esm",
  meteor: "https://cdn.jsdelivr.net/npm/@near-wallet-selector/meteor-wallet@10.1.4/+esm",
  modal: "https://cdn.jsdelivr.net/npm/@near-wallet-selector/modal-ui@10.1.4/+esm",
};

var PAY_GAS = "100000000000000"; // 100 TGas for ft_transfer_call + ft_on_transfer + ft_resolve_transfer
var ONE_YOCTO = "1";
var RECEIPTS_STORAGE_KEY = "billsettle:receipts:" + BILLS_CONTRACT;

// Bill id -> payment transaction hash, recorded from real on-chain payments.
// B1 (slice-3 CLI) and B2 (slice-4 Meteor browser test) verified on NEAR testnet.
var KNOWN_RECEIPTS = {
  B1: "9fxsLpNoP1LFPwMMnjZjdqWqZejvtxB3AJxocZDXr9ge",
  B2: "8FZRqV8nAbXosgXfR6BwBGv6utb3LMFPKEP4Gf1PuJ9k",
};

var currentView = { type: "dashboard", filter: "" };
var currentBill = null;
var cachedSummary = null;
var renderSeq = 0;

var walletState = {
  ready: false,
  failed: false,
  selector: null,
  modal: null,
  internalActionToNaj: null,
  accountId: null,
  balance: null,
  balanceError: null,
  busy: false,
};

function b64utf8(obj) {
  var s = JSON.stringify(obj);
  var bytes = new TextEncoder().encode(s);
  var bin = "";
  bytes.forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin);
}

async function rpcView(contract, method, args) {
  var lastErr = null;
  var payload = JSON.stringify({
    jsonrpc: "2.0",
    id: "billsettle-demo",
    method: "query",
    params: {
      request_type: "call_function",
      account_id: contract,
      method_name: method,
      args_base64: b64utf8(args),
      finality: "final",
    },
  });

  for (var i = 0; i < RPC_URLS.length; i++) {
    try {
      var res = await fetch(RPC_URLS[i], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!res.ok) throw new Error("RPC HTTP " + res.status);
      var data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      var raw = new TextDecoder().decode(new Uint8Array(data.result.result));
      return JSON.parse(raw);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("All NEAR testnet RPC endpoints failed");
}

function fmtBSDD(units) {
  var u = BigInt(units);
  var whole = u / 1000000n;
  var frac = u % 1000000n;
  var f = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return whole.toString() + (f ? "." + f : "") + " BSDD";
}

function fmtTime(ns) {
  if (!ns) return "—";
  return new Date(Number(BigInt(ns) / 1000000n)).toLocaleString();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function pill(status) {
  return '<span class="pill ' + (status === "Paid" ? "paid" : "unpaid") + '">' + esc(status) + "</span>";
}

function billUrl(id) {
  return window.location.origin + window.location.pathname + "#/bill/" + encodeURIComponent(id);
}

function explorerTxLink(txHash) {
  var h = esc(txHash);
  return '<a class="mono" href="' + EXPLORER + "/transactions/" + encodeURIComponent(txHash) +
    '" target="_blank" rel="noopener">' + h + "</a>";
}

function loadStoredReceipts() {
  try {
    var raw = window.localStorage.getItem(RECEIPTS_STORAGE_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function getReceiptTxHash(billId) {
  if (KNOWN_RECEIPTS[billId]) return KNOWN_RECEIPTS[billId];
  var stored = loadStoredReceipts();
  return stored[billId] || null;
}

function saveReceiptTxHash(billId, txHash) {
  if (!billId || !txHash) return;
  try {
    var stored = loadStoredReceipts();
    stored[billId] = txHash;
    window.localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(stored));
  } catch (_) {
    // Non-fatal if storage is blocked (e.g. private browsing).
  }
}

function renderError(msg) {
  currentBill = null;
  document.getElementById("app").innerHTML =
    '<div class="err">Could not load bills from NEAR testnet: ' + esc(msg) +
    "<br>Check the contracts on the explorer directly: " +
    '<a href="' + EXPLORER + "/accounts/" + BILLS_CONTRACT + '">' + BILLS_CONTRACT + "</a></div>";
}

function updateHeaderWallet() {
  var statusEl = document.getElementById("wallet-status");
  var btn = document.getElementById("wallet-action-btn");
  var dot = document.getElementById("wallet-dot");
  if (dot) {
    dot.className = walletState.accountId ? "status-dot connected" : "status-dot";
  }
  if (!statusEl || !btn) return;

  if (walletState.accountId) {
    var balText = walletState.balance !== null
      ? fmtBSDD(walletState.balance)
      : (walletState.balanceError ? "BSDD balance unavailable" : "Checking BSDD…");
    statusEl.innerHTML = '<strong class="mono">' + esc(walletState.accountId) + "</strong> · " + esc(balText);
    btn.textContent = "Disconnect";
    btn.className = "btn secondary";
    btn.disabled = walletState.busy;
  } else if (walletState.ready) {
    statusEl.textContent = "View-only mode";
    btn.textContent = "Connect wallet";
    btn.className = "btn";
    btn.disabled = walletState.busy;
  } else if (walletState.failed) {
    statusEl.textContent = "View-only mode";
    btn.textContent = "Wallet unavailable";
    btn.className = "btn secondary";
    btn.disabled = true;
  } else {
    statusEl.textContent = "View-only mode";
    btn.textContent = "Loading wallet…";
    btn.className = "btn secondary";
    btn.disabled = true;
  }
}

async function refreshBalance(accountId) {
  if (!accountId) return;
  try {
    var bal = await rpcView(TOKEN_CONTRACT, "ft_balance_of", { account_id: accountId });
    if (walletState.accountId !== accountId) return;
    walletState.balance = String(bal);
    walletState.balanceError = null;
  } catch (err) {
    if (walletState.accountId !== accountId) return;
    walletState.balance = null;
    walletState.balanceError = err && err.message ? err.message : "Failed to check balance";
  }
  updateHeaderWallet();
  if (!walletState.busy && currentView.type === "bill" && currentBill && currentBill.id === currentView.id) {
    renderPayCard(currentBill);
  }
}

function syncWalletState(state) {
  var accounts = (state && state.accounts) || [];
  var active = accounts.find(function (a) { return a.active; }) || accounts[0] || null;
  var nextId = active ? active.accountId : null;
  if (nextId === walletState.accountId) {
    updateHeaderWallet();
    return;
  }
  walletState.accountId = nextId;
  walletState.balance = null;
  walletState.balanceError = null;
  updateHeaderWallet();

  if (nextId) refreshBalance(nextId);
  if (!walletState.busy && currentView.type === "bill" && currentBill && currentBill.id === currentView.id) {
    renderPayCard(currentBill);
  }
}

async function initWallet() {
  var btn = document.getElementById("wallet-action-btn");
  if (btn) {
    btn.addEventListener("click", async function () {
      if (walletState.busy) return;
      if (walletState.accountId && walletState.selector) {
        try {
          var wallet = await walletState.selector.wallet();
          await wallet.signOut();
        } catch (err) {
          console.warn("Wallet signOut failed:", err);
        }
      } else if (walletState.ready && walletState.modal) {
        walletState.modal.show();
      }
    });
  }

  try {
    var mods = await Promise.all([
      import(WALLET_CDN.core),
      import(WALLET_CDN.meteor),
      import(WALLET_CDN.modal),
    ]);
    var coreMod = mods[0];
    var meteorMod = mods[1];
    var modalMod = mods[2];

    var selector = await coreMod.setupWalletSelector({
      network: "testnet",
      fallbackRpcUrls: RPC_URLS,
      modules: [meteorMod.setupMeteorWallet()],
    });
    // Omit contractId so sign-in does not require gas for an unused FunctionCall AddKey;
    // ft_transfer_call (1 yoctoNEAR) always signs via Meteor's approval popup on token contract.
    var modal = modalMod.setupModal(selector, {
      theme: "light",
      description: "Connect your NEAR testnet wallet (Meteor) to pay unpaid BSDD bills.",
    });

    walletState.selector = selector;
    walletState.modal = modal;
    walletState.internalActionToNaj = coreMod.internalActionToNaj;
    walletState.ready = true;
    walletState.failed = false;

    syncWalletState(selector.store.getState());
    selector.store.observable.subscribe(syncWalletState);
  } catch (err) {
    console.warn("Wallet selector initialization failed; staying in view-only mode:", err);
    walletState.failed = true;
    walletState.ready = false;
    updateHeaderWallet();
  }

  if (!walletState.busy && currentView.type === "bill" && currentBill && currentBill.id === currentView.id) {
    renderPayCard(currentBill);
  }
}

function compareBillId(a, b) {
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: "base" });
}

function computeSummary(bills) {
  var paidCount = 0;
  var unpaidCount = 0;
  var settled = 0n;
  var pending = 0n;
  for (var i = 0; i < bills.length; i++) {
    var amt = BigInt(bills[i].total || "0");
    if (bills[i].status === "Paid") {
      paidCount += 1;
      settled += amt;
    } else {
      unpaidCount += 1;
      pending += amt;
    }
  }
  return {
    totalCount: bills.length,
    paidCount: paidCount,
    unpaidCount: unpaidCount,
    totalVolume: settled + pending,
    settled: settled,
    pending: pending,
  };
}

function renderKpis(summary) {
  var row = document.getElementById("kpi-row");
  if (!row || !summary) return;
  row.innerHTML =
    '<div class="kpi-card">' +
      '<div class="kpi-label">Total Billed</div>' +
      '<div class="kpi-value">' + esc(fmtBSDD(summary.totalVolume)) + "</div>" +
      '<div class="kpi-sub">' + summary.totalCount + " invoice(s) on NEAR testnet</div>" +
    "</div>" +
    '<div class="kpi-card settled">' +
      '<div class="kpi-label">Settled On-Chain</div>' +
      '<div class="kpi-value">' + esc(fmtBSDD(summary.settled)) + "</div>" +
      '<div class="kpi-sub">' + summary.paidCount + " verified paid</div>" +
    "</div>" +
    '<div class="kpi-card pending">' +
      '<div class="kpi-label">Awaiting Settlement</div>' +
      '<div class="kpi-value">' + esc(fmtBSDD(summary.pending)) + "</div>" +
      '<div class="kpi-sub">' + summary.unpaidCount + " open unpaid</div>" +
    "</div>";

  var tabAll = document.querySelector('.tabs button[data-f=""]');
  var tabUnpaid = document.querySelector('.tabs button[data-f="Unpaid"]');
  var tabPaid = document.querySelector('.tabs button[data-f="Paid"]');
  if (tabAll) tabAll.textContent = "All bills (" + summary.totalCount + ")";
  if (tabUnpaid) tabUnpaid.textContent = "Unpaid (" + summary.unpaidCount + ")";
  if (tabPaid) tabPaid.textContent = "Paid (" + summary.paidCount + ")";
}

function bindCopy(btnId, text, defaultLabel) {
  var btn = document.getElementById(btnId);
  if (!btn || !text) return;
  btn.addEventListener("click", function () {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "Copied ✓";
      setTimeout(function () {
        if (document.body.contains(btn)) btn.textContent = defaultLabel;
      }, 1500);
    }).catch(function () {});
  });
}

function billCard(b) {
  var isPaid = b.status === "Paid";
  return (
    '<div class="bill ' + (isPaid ? "is-paid" : "is-unpaid") + '" data-id="' + esc(b.id) + '" role="button" tabindex="0">' +
      '<div class="bill-left">' +
        '<div class="bill-id-badge">' + esc(b.id) + "</div>" +
        "<div>" +
          '<div class="bill-title-row"><h3>Bill ' + esc(b.id) + "</h3> " + pill(b.status) + "</div>" +
          '<div class="meta">' + b.items.length + " item(s) · Shop: <span class='mono'>" + esc(b.shop) + "</span>" +
          (b.payer ? " · Paid by <span class='mono'>" + esc(b.payer) + "</span>" : "") + "</div>" +
        "</div>" +
      "</div>" +
      '<div class="bill-right">' +
        '<div class="total">' + fmtBSDD(b.total) + "</div>" +
        '<div class="bill-cta">' + (isPaid ? "View receipt →" : "Pay or QR →") + "</div>" +
      "</div>" +
    "</div>"
  );
}

function renderDashboard(filter) {
  currentView = { type: "dashboard", filter: filter };
  currentBill = null;
  var seq = ++renderSeq;

  var app = document.getElementById("app");
  app.innerHTML =
    '<div class="kpi-grid" id="kpi-row">' +
      '<div class="kpi-card"><div class="kpi-label">Total Billed</div><div class="kpi-value">—</div><div class="kpi-sub">Querying chain…</div></div>' +
      '<div class="kpi-card settled"><div class="kpi-label">Settled On-Chain</div><div class="kpi-value">—</div><div class="kpi-sub">Querying chain…</div></div>' +
      '<div class="kpi-card pending"><div class="kpi-label">Awaiting Settlement</div><div class="kpi-value">—</div><div class="kpi-sub">Querying chain…</div></div>' +
    "</div>" +
    '<div class="section-head">' +
      '<h2 class="section-title">Invoices &amp; Bills</h2>' +
      '<div class="tabs">' +
        '<button data-f="" class="' + (filter === "" ? "active" : "") + '">All bills</button>' +
        '<button data-f="Unpaid" class="' + (filter === "Unpaid" ? "active" : "") + '">Unpaid</button>' +
        '<button data-f="Paid" class="' + (filter === "Paid" ? "active" : "") + '">Paid</button>' +
      "</div>" +
    "</div>" +
    '<div id="list"><div class="card"><p class="muted" style="margin:0">Loading bills from NEAR testnet…</p></div></div>' +
    '<div class="card">' +
      '<div class="card-title-row"><h3>How On-Chain Settlement Works</h3><span class="mono muted">NEP-141 · NEAR Testnet</span></div>' +
      '<div class="flow-grid">' +
        '<div class="flow-step"><span class="flow-num">1</span><strong>Issue Invoice</strong><span>Shop registers items and exact BSDD total on <code>billsettle-bills.testnet</code>.</span></div>' +
        '<div class="flow-step"><span class="flow-num">2</span><strong>Sign in Browser</strong><span>Customer connects Meteor Wallet and signs <code>ft_transfer_call</code> with <code>msg = bill_id</code>.</span></div>' +
        '<div class="flow-step"><span class="flow-num">3</span><strong>Atomic Settle</strong><span>Bills contract checks exact amount and flips status to <code>Paid</code> (or auto-refunds).</span></div>' +
        '<div class="flow-step"><span class="flow-num">4</span><strong>Verified Receipt</strong><span>Frontend confirms <code>get_bill</code> on-chain and links the real Explorer tx hash.</span></div>' +
      "</div>" +
      '<div class="muted">Merchant: <span class="mono">' + SHOP_ACCOUNT + "</span> · " +
      'Token: <span class="mono">' + TOKEN_CONTRACT + "</span> (BSDD, 6 decimals, mock testnet stablecoin).</div>" +
    "</div>";

  if (cachedSummary) renderKpis(cachedSummary);

  app.querySelectorAll(".tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () { renderDashboard(btn.getAttribute("data-f")); });
  });

  if (filter !== "" && !cachedSummary) {
    rpcView(BILLS_CONTRACT, "list_bills", { status: null, from_index: 0, limit: 50 })
      .then(function (allBills) {
        if (seq !== renderSeq) return;
        cachedSummary = computeSummary(allBills);
        renderKpis(cachedSummary);
      })
      .catch(function () {});
  }

  var args = { status: filter === "" ? null : filter, from_index: 0, limit: 50 };
  rpcView(BILLS_CONTRACT, "list_bills", args)
    .then(function (bills) {
      if (seq !== renderSeq) return;
      var sorted = bills.slice().sort(compareBillId);
      if (filter === "") {
        cachedSummary = computeSummary(sorted);
        renderKpis(cachedSummary);
      }
      var list = document.getElementById("list");
      if (!list) return;
      if (!sorted.length) {
        list.innerHTML = '<div class="card"><p class="muted" style="margin:0">No bills in this view yet.</p></div>';
        return;
      }
      list.innerHTML = '<div class="bill-list">' + sorted.map(billCard).join("") + "</div>";
      list.querySelectorAll(".bill").forEach(function (el) {
        var openBill = function () {
          window.location.hash = "#/bill/" + encodeURIComponent(el.getAttribute("data-id"));
        };
        el.addEventListener("click", openBill);
        el.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            openBill();
          }
        });
      });
    })
    .catch(function (e) {
      if (seq !== renderSeq) return;
      renderError(e.message);
    });
}

function formatFailure(failure) {
  if (!failure) return "Unknown transaction failure";
  if (typeof failure === "string") return failure;
  var kind = failure.ActionError && failure.ActionError.kind;
  if (kind && kind.FunctionCallError && kind.FunctionCallError.ExecutionError) {
    return kind.FunctionCallError.ExecutionError;
  }
  return JSON.stringify(failure);
}

function extractTxHash(outcome) {
  if (!outcome || typeof outcome !== "object") return null;
  if (outcome.transaction && outcome.transaction.hash) return outcome.transaction.hash;
  if (outcome.transaction_outcome && outcome.transaction_outcome.id) return outcome.transaction_outcome.id;
  return null;
}

function findOutcomeError(outcome) {
  if (!outcome || typeof outcome !== "object") return "No transaction outcome returned.";
  if (outcome.status && outcome.status.Failure) {
    return formatFailure(outcome.status.Failure);
  }
  var receipts = Array.isArray(outcome.receipts_outcome) ? outcome.receipts_outcome : [];
  for (var i = 0; i < receipts.length; i++) {
    var st = receipts[i] && receipts[i].outcome && receipts[i].outcome.status;
    if (st && st.Failure) {
      return formatFailure(st.Failure);
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function waitForBillPaid(billId) {
  for (var attempt = 0; attempt < 6; attempt++) {
    var bill = await rpcView(BILLS_CONTRACT, "get_bill", { id: billId });
    if (bill && bill.status === "Paid") return bill;
    if (attempt < 5) await sleep(1200);
  }
  return null;
}

function setPayFeedback(kind, html) {
  var el = document.getElementById("pay-feedback");
  if (!el) return;
  if (!html) {
    el.innerHTML = "";
    return;
  }
  var cls = kind === "err" ? "err" : (kind === "ok" ? "ok" : "warn");
  el.innerHTML = '<div class="' + cls + '">' + html + "</div>";
}

function buildManualCallPre(b) {
  return (
    "<pre>ft_transfer_call on " + TOKEN_CONTRACT + "\n" +
    "receiver_id: " + BILLS_CONTRACT + "\n" +
    'amount: "' + esc(b.total) + '"\n' +
    'msg: "' + esc(b.id) + '"</pre>'
  );
}

function buildReceiptHtml(b) {
  if (b.status === "Paid") {
    var tx = getReceiptTxHash(b.id);
    return (
      '<div class="card-title-row"><h3>Verified Receipt</h3><span class="pill paid">Settled On-Chain</span></div>' +
      '<div class="receipt-grid">' +
        '<div class="receipt-row"><span class="k">Paid by</span><span class="v mono">' + esc(b.payer || "—") + "</span></div>" +
        '<div class="receipt-row"><span class="k">Paid at</span><span class="v">' + esc(fmtTime(b.paid_at)) + "</span></div>" +
        '<div class="receipt-row"><span class="k">Payment tx</span><span class="v">' +
          (tx
            ? explorerTxLink(tx)
            : '<span class="muted" style="font-weight:400">Recorded by paying browser at payment time</span>') +
        "</span></div>" +
      "</div>" +
      (tx
        ? '<div class="pay-box" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:0">' +
            '<a class="btn sm" href="' + EXPLORER + "/transactions/" + encodeURIComponent(tx) + '" target="_blank" rel="noopener">View on NEAR Explorer ↗</a>' +
            '<button type="button" class="btn secondary sm" id="copy-tx-btn">Copy tx hash</button>' +
          "</div>"
        : "")
    );
  }

  var pre = buildManualCallPre(b);
  if (walletState.accountId) {
    var balText = walletState.balance !== null
      ? fmtBSDD(walletState.balance)
      : (walletState.balanceError ? "unavailable (" + esc(walletState.balanceError) + ")" : "checking…");
    var insufficient = walletState.balance !== null && BigInt(walletState.balance) < BigInt(b.total);
    return (
      '<div class="card-title-row"><h3>Settle Invoice</h3><span class="mono muted">NEAR Testnet</span></div>' +
      '<div class="wallet-summary-box">' +
        '<div><span class="muted">Paying account</span><br><strong class="mono">' + esc(walletState.accountId) + "</strong></div>" +
        '<div style="text-align:right"><span class="muted">Available balance</span><br><strong>' + esc(balText) + "</strong></div>" +
      "</div>" +
      (insufficient
        ? '<div class="warn">Insufficient BSDD balance (' + esc(fmtBSDD(walletState.balance)) +
          ") to settle " + fmtBSDD(b.total) + ". Mint or transfer testnet BSDD first, or switch accounts.</div>"
        : "") +
      '<div class="pay-box">' +
        '<button type="button" class="btn lg" id="pay-bill-btn"' +
        (insufficient || walletState.busy ? " disabled" : "") + ">" +
        "Pay " + fmtBSDD(b.total) + "</button>" +
      "</div>" +
      '<div id="pay-feedback"></div>' +
      '<details class="muted"><summary>Transaction parameters (<code>ft_transfer_call</code>, 1 yoctoNEAR)</summary>' +
      pre + "</details>"
    );
  }

  var connectSection = "";
  if (walletState.ready) {
    connectSection =
      '<div class="pay-box"><button type="button" class="btn lg" id="inline-connect-btn">Connect wallet to pay</button></div>';
  } else if (walletState.failed) {
    connectSection =
      '<p class="muted">In-browser wallet module could not load — you can still pay via CLI or another wallet using the parameters below.</p>';
  } else {
    connectSection =
      '<p class="muted">Loading in-browser wallet connector…</p>';
  }

  return (
    '<div class="card-title-row"><h3>Settle Invoice</h3><span class="mono muted">Meteor Wallet</span></div>' +
    "<p class='muted' style='margin-top:0'>Connect your NEAR testnet wallet to settle <strong>" +
    fmtBSDD(b.total) + "</strong> in BSDD directly in your browser.</p>" +
    connectSection +
    '<details class="muted"><summary>CLI / external wallet parameters (<code>ft_transfer_call</code>)</summary>' +
    pre + "</details>" +
    "<p class='muted' style='margin:10px 0 0'>Mock BSDD on NEAR testnet (6 decimals, no real money).</p>"
  );
}

function wirePayCardEvents(b) {
  var connectBtn = document.getElementById("inline-connect-btn");
  if (connectBtn && walletState.modal) {
    connectBtn.addEventListener("click", function () {
      walletState.modal.show();
    });
  }
  var payBtn = document.getElementById("pay-bill-btn");
  if (payBtn) {
    payBtn.addEventListener("click", function () {
      payBill(b);
    });
  }
  if (b.status === "Paid") {
    var tx = getReceiptTxHash(b.id);
    if (tx) bindCopy("copy-tx-btn", tx, "Copy tx hash");
  }
}

function renderPayCard(b) {
  var card = document.getElementById("pay-card");
  if (!card) return;
  card.innerHTML = buildReceiptHtml(b);
  wirePayCardEvents(b);
}

async function payBill(b) {
  if (walletState.busy || !walletState.selector || !walletState.accountId || !walletState.internalActionToNaj) {
    return;
  }
  walletState.busy = true;
  updateHeaderWallet();
  var payBtn = document.getElementById("pay-bill-btn");
  if (payBtn) payBtn.disabled = true;
  setPayFeedback("warn", "Waiting for Meteor Wallet signature (" + fmtBSDD(b.total) + " + 1 yoctoNEAR)…");

  var txHash = null;
  try {
    var wallet = await walletState.selector.wallet();
    var action = walletState.internalActionToNaj({
      type: "FunctionCall",
      params: {
        methodName: "ft_transfer_call",
        args: {
          receiver_id: BILLS_CONTRACT,
          amount: String(b.total),
          memo: null,
          msg: b.id,
        },
        gas: PAY_GAS,
        deposit: ONE_YOCTO,
      },
    });

    var outcome = await wallet.signAndSendTransaction({
      signerId: walletState.accountId,
      receiverId: TOKEN_CONTRACT,
      actions: [action],
    });

    if (!outcome) {
      throw new Error("Transaction was cancelled or no outcome was returned.");
    }

    txHash = extractTxHash(outcome);
    var outcomeErr = findOutcomeError(outcome);
    if (outcomeErr) {
      throw new Error("Payment did not succeed (tokens refunded if transfer ran): " + outcomeErr);
    }

    setPayFeedback(
      "warn",
      "Transaction broadcast" + (txHash ? " (" + explorerTxLink(txHash) + ")" : "") +
      ". Confirming Paid status on-chain…"
    );

    var paidBill = await waitForBillPaid(b.id);
    if (!paidBill) {
      throw new Error(
        "Transaction submitted, but bill " + b.id +
        " is not marked Paid on-chain yet. Refresh in a moment or inspect the transaction on Explorer."
      );
    }

    if (txHash) saveReceiptTxHash(b.id, txHash);
    cachedSummary = null;
    walletState.busy = false;
    updateHeaderWallet();
    refreshBalance(walletState.accountId);
    renderBill(b.id);
  } catch (err) {
    walletState.busy = false;
    updateHeaderWallet();
    if (payBtn) payBtn.disabled = false;
    var msg = err && err.message ? err.message : String(err);
    var extra = txHash ? "<br>Transaction: " + explorerTxLink(txHash) : "";
    setPayFeedback(
      "err",
      esc(msg) + extra +
      '<br><button type="button" class="btn secondary sm" id="recheck-bill-btn" style="margin-top:8px">Re-check on-chain status</button>'
    );
    var recheckBtn = document.getElementById("recheck-bill-btn");
    if (recheckBtn) {
      recheckBtn.addEventListener("click", function () { renderBill(b.id); });
    }
  }
}

function renderBill(id) {
  currentView = { type: "bill", id: id };
  currentBill = null;
  var seq = ++renderSeq;

  var app = document.getElementById("app");
  app.innerHTML = '<div class="card"><p class="muted" style="margin:0">Loading bill ' + esc(id) + " from NEAR testnet…</p></div>";
  rpcView(BILLS_CONTRACT, "get_bill", { id: id })
    .then(function (b) {
      if (seq !== renderSeq) return;
      if (!b) {
        app.innerHTML = '<div class="err">Bill ' + esc(id) + " not found on-chain.</div>" +
          '<p><a class="btn secondary" href="#">← Back to dashboard</a></p>';
        return;
      }
      currentBill = b;
      var rows = b.items.map(function (it) {
        return "<tr><td>" + esc(it.name) + "</td><td>" + fmtBSDD(it.amount) + "</td></tr>";
      }).join("");
      var url = billUrl(b.id);
      var isPaid = b.status === "Paid";

      app.innerHTML =
        '<div class="detail-topbar">' +
          '<a class="btn secondary sm" href="#">← Back to dashboard</a>' +
          '<span class="mono muted">Registry: ' + esc(BILLS_CONTRACT) + " · Bill #" + esc(b.id) + "</span>" +
        "</div>" +
        '<div class="bill-grid">' +
          "<div>" +
            '<div class="card">' +
              '<div class="invoice-header">' +
                "<div>" +
                  "<h2>Bill " + esc(b.id) + "</h2>" +
                  '<div class="muted">Merchant: <span class="mono">' + esc(b.shop) + "</span></div>" +
                "</div>" +
                pill(b.status) +
              "</div>" +
              '<table class="invoice-table">' +
                "<thead><tr><th>Line Item</th><th>Amount</th></tr></thead>" +
                "<tbody>" + rows + "</tbody>" +
              "</table>" +
              '<div class="invoice-total-bar">' +
                '<span class="label">' + (isPaid ? "Total Paid" : "Total Due") + "</span>" +
                '<span class="total">' + fmtBSDD(b.total) + "</span>" +
              "</div>" +
            "</div>" +
            '<div class="card" id="pay-card">' + buildReceiptHtml(b) + "</div>" +
          "</div>" +
          '<div class="card qr-card">' +
            "<h3>QR — Share or Pay</h3>" +
            '<p class="muted" style="margin:4px 0 0">Scan to open this invoice on any device</p>' +
            '<div class="qr-frame"><div class="qrbox" id="qr"></div></div>' +
            '<div class="url-box mono">' + esc(url) + "</div>" +
            '<button type="button" class="btn secondary sm" id="copy-url-btn" style="width:100%">Copy bill link</button>' +
          "</div>" +
        "</div>";

      wirePayCardEvents(b);
      bindCopy("copy-url-btn", url, "Copy bill link");

      var qrEl = document.getElementById("qr");
      if (window.QRCode) {
        new QRCode(qrEl, { text: url, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
      } else {
        qrEl.innerHTML = '<p class="muted">QR library did not load — use the link above.</p>';
      }
    })
    .catch(function (e) {
      if (seq !== renderSeq) return;
      renderError(e.message);
    });
}

function route() {
  var m = window.location.hash.match(/^#\/bill\/(.+)$/);
  if (m) renderBill(decodeURIComponent(m[1]));
  else renderDashboard("");
}

window.addEventListener("hashchange", route);
updateHeaderWallet();
route();
initWallet();
