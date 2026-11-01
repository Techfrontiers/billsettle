// BillSettle demo frontend — view-only (no keys, no signing).
// Reads live on-chain data from NEAR testnet via raw JSON-RPC.
// The payment itself is an ft_transfer_call on the token contract:
// a wallet-signed transaction, whose hash becomes the receipt.
// Demo receipt recorded from the slice-3 on-chain test (do not fake others).
"use strict";

var BILLS_CONTRACT = "billsettle-bills.testnet";
var TOKEN_CONTRACT = "billsettle-token.testnet";
var SHOP_ACCOUNT = "billsettle-shop.testnet";
var RPC_URL = "https://rpc.testnet.near.org";
var EXPLORER = "https://explorer.testnet.near.org";

// Bill id -> payment transaction hash, recorded from real on-chain payments.
// B1 was paid in the slice-3 CLI test; its hash is the receipt.
var KNOWN_RECEIPTS = {
  B1: "9fxsLpNoP1LFPwMMnjZjdqWqZejvtxB3AJxocZDXr9ge",
};

function b64utf8(obj) {
  var s = JSON.stringify(obj);
  var bytes = new TextEncoder().encode(s);
  var bin = "";
  bytes.forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function rpcView(contract, method, args) {
  return fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      var raw = new TextDecoder().decode(new Uint8Array(d.result.result));
      return JSON.parse(raw);
    });
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

function renderError(msg) {
  document.getElementById("app").innerHTML =
    '<div class="err">Could not load bills from NEAR testnet: ' + esc(msg) +
    "<br>Check the contracts on the explorer directly: " +
    '<a href="' + EXPLORER + "/accounts/" + BILLS_CONTRACT + '">' + BILLS_CONTRACT + "</a></div>";
}

function billCard(b) {
  return (
    '<div class="card bill" data-id="' + esc(b.id) + '">' +
    "<h3>Bill " + esc(b.id) + " " + pill(b.status) + "</h3>" +
    '<div class="meta">' + b.items.length + " item(s) · Shop: " + esc(b.shop) +
    (b.payer ? " · Paid by: " + esc(b.payer) : "") + "</div>" +
    '<div class="total">' + fmtBSDD(b.total) + "</div>" +
    '<div class="meta">Click for details, QR code and receipt.</div>' +
    "</div>"
  );
}

function renderDashboard(filter) {
  var app = document.getElementById("app");
  app.innerHTML =
    '<div class="tabs">' +
    '<button data-f="" class="' + (filter === "" ? "active" : "") + '">All bills</button>' +
    '<button data-f="Unpaid" class="' + (filter === "Unpaid" ? "active" : "") + '">Unpaid</button>' +
    '<button data-f="Paid" class="' + (filter === "Paid" ? "active" : "") + '">Paid</button>' +
    "</div>" +
    '<div id="list"><p class="muted">Loading…</p></div>' +
    '<div class="card"><h3>How the demo works</h3>' +
    "<p>1. The shop creates a bill on-chain (items + total).<br>" +
    "2. The customer pays with BSDD, the demo stablecoin, via " +
    "<code>ft_transfer_call</code> on the token contract with the bill id as the message.<br>" +
    "3. The bills contract flips the bill to Paid and the dashboard updates.<br>" +
    "4. The receipt's transaction hash comes from the payment transaction itself — " +
    "contracts cannot read their own tx hash, so the paying wallet records it.</p>" +
    "<p>Shop: <span class='mono'>" + SHOP_ACCOUNT + "</span> · " +
    "Token: <span class='mono'>" + TOKEN_CONTRACT + "</span> (BSDD, 6 decimals, mock NEP-141 on testnet).</p></div>";
  app.querySelectorAll(".tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () { renderDashboard(btn.getAttribute("data-f")); });
  });
  var args = { status: filter === "" ? null : filter, from_index: 0, limit: 50 };
  rpcView(BILLS_CONTRACT, "list_bills", args)
    .then(function (bills) {
      var list = document.getElementById("list");
      if (!bills.length) {
        list.innerHTML = '<p class="muted">No bills in this view yet.</p>';
        return;
      }
      list.innerHTML = bills.map(billCard).join("");
      list.querySelectorAll(".bill").forEach(function (el) {
        el.addEventListener("click", function () { renderBill(el.getAttribute("data-id")); });
      });
    })
    .catch(function (e) { renderError(e.message); });
}

function renderBill(id) {
  var app = document.getElementById("app");
  app.innerHTML = '<p class="muted">Loading bill ' + esc(id) + "…</p>";
  rpcView(BILLS_CONTRACT, "get_bill", { id: id })
    .then(function (b) {
      if (!b) {
        app.innerHTML = '<div class="err">Bill ' + esc(id) + " not found on-chain.</div>" +
          '<p><a class="btn secondary" href="#">← Back to dashboard</a></p>';
        return;
      }
      var rows = b.items.map(function (it) {
        return "<tr><td>" + esc(it.name) + "</td><td>" + fmtBSDD(it.amount) + "</td></tr>";
      }).join("");
      var receipt = "";
      if (b.status === "Paid") {
        var tx = KNOWN_RECEIPTS[b.id];
        receipt =
          "<h3>🧾 Receipt</h3>" +
          "<p>Paid by: <span class='mono'>" + esc(b.payer || "—") + "</span><br>" +
          "Paid at: " + esc(fmtTime(b.paid_at)) + "<br>" +
          (tx
            ? 'Payment transaction: <a class="mono" href="' + EXPLORER + "/transactions/" + tx + '" target="_blank" rel="noopener">' + tx + "</a>"
            : "Payment transaction hash: recorded by the paying wallet at payment time (this bill was paid outside this page, so no hash is stored on-chain).") +
          "</p>";
      } else {
        receipt =
          "<h3>💳 Pay this bill (testnet)</h3>" +
          "<p>Pay <strong>" + fmtBSDD(b.total) + "</strong> in BSDD from a NEAR testnet wallet:</p>" +
          "<pre>ft_transfer_call on " + TOKEN_CONTRACT + "\n" +
          "receiver_id: " + BILLS_CONTRACT + "\n" +
          "amount: \"" + esc(b.total) + "\"\n" +
          'msg: "' + esc(b.id) + '"</pre>' +
          "<p class='muted'>In-browser wallet signing lands next: this page is view-only for now, " +
          "and the full pay flow is already proven on-chain (see bill B1's receipt).</p>";
      }
      app.innerHTML =
        '<p><a class="btn secondary" href="#">← Back to dashboard</a></p>' +
        '<div class="card">' +
        "<h3>Bill " + esc(b.id) + " " + pill(b.status) + "</h3>" +
        "<table>" + rows + "</table>" +
        '<div class="total">Total: ' + fmtBSDD(b.total) + "</div>" +
        '<p class="meta">Shop: ' + esc(b.shop) + "</p>" +
        "</div>" +
        '<div class="card"><h3>QR — open this bill</h3>' +
        '<div class="qrbox" id="qr"></div>' +
        '<p class="mono" style="text-align:center">' + esc(billUrl(b.id)) + "</p></div>" +
        '<div class="card">' + receipt + "</div>";
      var qrEl = document.getElementById("qr");
      if (window.QRCode) {
        new QRCode(qrEl, { text: billUrl(b.id), width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
      } else {
        qrEl.innerHTML = '<p class="muted">QR library did not load — use the link above.</p>';
      }
    })
    .catch(function (e) { renderError(e.message); });
}

function route() {
  var m = window.location.hash.match(/^#\/bill\/(.+)$/);
  if (m) renderBill(decodeURIComponent(m[1]));
  else renderDashboard("");
}

window.addEventListener("hashchange", route);
route();
