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

// Concordium Trusted Agents (Testnet CIS-8004 #12802, Native Agent #1185)
var CCD_BADGE_SHORT = "JyP9WvdiYC2ADhyQTirr5";
var CCD_BADGE_CAIP19 = "ccd:4221332d34e1694168c2a0c0b3fd0f27/cis-2:" + CCD_BADGE_SHORT;
var CCD_TOKEN_ID = 1185;
var CCD_TOKEN_HEX = "a104000000000000";
var CCD_CONTRACT_INDEX = 12802;
var CCD_CONTRACT_SUBINDEX = 0;
var CCD_OWNER = "3fFCiJ13LTXL9j2GaNAAMq5C3xMNpcdQGTyt6VgkCkxjz1SKW9";
var CCD_REG_TX = "8d81b6b70c22a92e2c3590906586ea0d8256f629139b1126771571d504e2bb0e";
var CCD_TESTNET_GENESIS = "4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796";
var CCD_AGENT_CARD_URL = "https://techfrontiers.github.io/billsettle/.well-known/agent-card.json";
var CCD_BADGE_CHECK_URL = "https://agent-registry-mcp.concordium.com/v1/badge-check/" + CCD_BADGE_SHORT;
var CCD_BUILD_SET_URI_URL = "https://agent-registry-mcp.concordium.com/v1/build-set-agent-uri/" + CCD_BADGE_SHORT;
var CCD_WC_PROJECT_ID = "6f13902528fdf8939f77b5ec33c5b9ab";
var CCD_WEB_SDK_CDN = "https://cdn.jsdelivr.net/npm/@concordium/web-sdk@12.0.2/+esm";
var CCD_CCDSCAN_TX_URL = "https://testnet.ccdscan.io/?dcount=2&dentity=transaction&dhash=" + CCD_REG_TX;
var CCD_CCDSCAN_TOKEN_URL = "https://testnet.ccdscan.io/?dcount=1&dentity=token&did=" + CCD_TOKEN_HEX + "&dcontractAddressIndex=" + CCD_CONTRACT_INDEX + "&dcontractAddressSubIndex=" + CCD_CONTRACT_SUBINDEX;
var CCD_EXPLORER_TX_URL = "https://ccdexplorer.io/testnet/transaction/" + CCD_REG_TX;
var CCD_EXPLORER_ACCOUNT_URL = "https://ccdexplorer.io/testnet/account/" + CCD_OWNER;
var CCD_EXPLORER_CONTRACT_URL = "https://ccdexplorer.io/testnet/contract/" + CCD_CONTRACT_INDEX + "/" + CCD_CONTRACT_SUBINDEX;
var CCD_REGISTRY_DASHBOARD_URL = "https://testnet-agent-registry.concordium.com/dashboard";
var CCD_REGISTRY_SCHEMA_B64 = "//8DAQAAAAgAAABDSVMtODAwNAEAFAAEAAAABQAAAGFkbWluCw0AAABjaXM4X2NvbnRyYWN0DA4AAABjaXMxMF9jb250cmFjdAwMAAAAZ2VuZXNpc19oYXNoEyAAAAACFQAAABgAAABhZ2VudEJ5RXh0ZXJuYWxSZWZlcmVuY2UCFAACAAAAEAAAAGNvbnRyYWN0X2FkZHJlc3MMBAAAAGtpbmQVAgAAAAQAAABDaXM4AQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIIAAAAa2V5X3R5cGUWAgoAAABwdWJsaWNfa2V5EAICBQAAAENpczEwAQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIPAAAAaWRlbnRpZmllcl90eXBlFgIKAAAAaWRlbnRpZmllchACAhUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABQACwAAAAgAAAB0b2tlbl9pZB0ADQAAAG93bmVyX2FjY291bnQLCQAAAGFnZW50X3VyaRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABYCDQAAAG1ldGFkYXRhX2hhc2gVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAATIAAAAAISAAAAZXh0ZXJuYWxfcmVmZXJlbmNlFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFAACAAAAEAAAAGNvbnRyYWN0X2FkZHJlc3MMBAAAAGtpbmQVAgAAAAQAAABDaXM4AQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIIAAAAa2V5X3R5cGUWAgoAAABwdWJsaWNfa2V5EAICBQAAAENpczEwAQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIPAAAAaWRlbnRpZmllcl90eXBlFgIKAAAAaWRlbnRpZmllchACAgwAAABhZ2VudF93YWxsZXQVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAALBgAAAHN0YXR1cxUCAAAABgAAAEFjdGl2ZQIHAAAAUmV2b2tlZAINAAAAcmVnaXN0ZXJlZF9hdA0KAAAAcmV2b2tlZF9hdBUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAAA0RAAAAcmV2b2NhdGlvbl9yZWFzb24VAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAAWAhEAAABvbl9jaGFpbl9tZXRh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";

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

var ccdState = {
  loading: true,
  data: null,
  error: null,
  servedSha256: null,
  checkedAt: null,
  signBusy: false,
  signMessage: "",
  signKind: "info",
  wcUri: null,
  wcShowPanel: false,
  pinnedTxHash: null,
  pollTimer: null,
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

function ccdScanTxUrl(txHash) {
  return "https://testnet.ccdscan.io/?dcount=2&dentity=transaction&dhash=" + encodeURIComponent(txHash);
}

function ccdExplorerTxUrl(txHash) {
  return "https://ccdexplorer.io/testnet/transaction/" + encodeURIComponent(txHash);
}

function shortCcdAccount(addr) {
  if (!addr || addr.length < 14) return addr || "—";
  return addr.slice(0, 6) + "…" + addr.slice(-6);
}

function ccdLogoSvg(cls) {
  return (
    '<svg class="' + (cls || "ccd-logo") + '" viewBox="0 0 88 88" fill="none" aria-hidden="true">' +
      '<rect x="0.5" y="0.5" width="87" height="87" rx="13.5" fill="#192736" stroke="#354559"/>' +
      '<path d="M25.9244 44C25.9244 53.9804 34.0071 62.0644 43.9949 62.0644C46.6677 62.0644 49.2041 61.4605 51.4879 60.4221V68.8981C49.1201 69.608 46.6049 70 43.9949 70C29.6395 70 18 58.3668 18 44C18 29.6333 29.6395 18 44.0051 18C46.6152 18 49.1201 18.392 51.4988 19.1019V27.5778C49.215 26.529 46.6787 25.9356 44.0051 25.9356C34.0283 25.9356 25.9353 34.0196 25.9353 44H25.9244ZM43.9949 55.0081C37.9113 55.0081 32.9758 50.0815 32.9758 43.9894C32.9758 37.8973 37.9113 32.9707 43.9949 32.9707C50.0778 32.9707 55.0133 37.9079 55.0133 43.9894C55.0133 50.0709 50.0778 55.0081 43.9949 55.0081ZM67.5585 55.0081H58.297C60.6443 51.9568 62.0647 48.1532 62.0647 44C62.0647 39.8468 60.6443 36.0326 58.2868 32.9813H67.5483C69.1161 36.3293 70 40.0587 70 44C70 47.9413 69.1161 51.6708 67.5483 55.0081" fill="white"/>' +
      '<path d="M32.9814 43.9992C32.9814 50.0913 37.917 55.0179 44.0005 55.0179C50.0834 55.0179 55.0189 50.0807 55.0189 43.9992C55.0189 37.9177 50.0834 32.9805 44.0005 32.9805C37.917 32.9805 32.9814 37.9071 32.9814 43.9992Z" fill="white"/>' +
      '<path d="M76 62C76 69.1797 70.1797 75 63 75C55.8203 75 50 69.1797 50 62C50 54.8203 55.8203 49 63 49C70.1797 49 76 54.8203 76 62Z" fill="#0069FF"/>' +
      '<path d="M76 62C76 54.8203 70.1797 49 63 49C55.8203 49 50 54.8203 50 62C50 69.1797 55.8203 75 63 75C70.1797 75 76 69.1797 76 62ZM78 62C78 70.2843 71.2843 77 63 77C54.7157 77 48 70.2843 48 62C48 53.7157 54.7157 47 63 47C71.2843 47 78 53.7157 78 62Z" fill="#192736"/>' +
      '<path d="M70.3595 57.335C69.9852 56.9821 69.486 56.7924 68.9717 56.8075C68.4575 56.8226 67.9703 57.0413 67.6172 57.4156L61.2792 64.1356L58.586 61.1336C58.4157 60.9439 58.2098 60.7897 57.9799 60.6796C57.75 60.5696 57.5007 60.5059 57.2462 60.4922C56.7322 60.4645 56.2283 60.6422 55.8453 60.9861C55.4623 61.3299 55.2316 61.8119 55.204 62.3259C55.1763 62.8398 55.354 63.3437 55.6978 63.7267L59.7997 68.2991C59.9793 68.4983 60.1982 68.6581 60.4426 68.7684C60.6871 68.8787 60.9518 68.9372 61.2199 68.94H61.2445C61.5088 68.9399 61.7704 68.8859 62.0131 68.7812C62.2558 68.6765 62.4745 68.5233 62.6559 68.331L70.4401 60.0764C70.7927 59.702 70.9823 59.203 70.9672 58.689C70.9521 58.175 70.7335 57.688 70.3595 57.335Z" fill="white"/>' +
    "</svg>"
  );
}

async function computeSha256Hex(buffer) {
  var digest = await window.crypto.subtle.digest("SHA-256", buffer);
  var arr = new Uint8Array(digest);
  var out = "";
  for (var i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function fetchServedCardSha256(url) {
  var res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Agent Card HTTP " + res.status);
  var buf = await res.arrayBuffer();
  return await computeSha256Hex(buf);
}

function getCcdStatusSummary() {
  if (ccdState.loading && !ccdState.data) {
    return { cls: "pending", text: "Verifying on-chain…" };
  }
  if (ccdState.error && !ccdState.data) {
    return { cls: "err", text: "Verification unavailable" };
  }
  var d = ccdState.data;
  var c = (d && d.checks) || {};
  if (d && d.badge_valid) {
    return { cls: "ok", text: "Verified · Card Hash Match ✓" };
  }
  if (c.on_chain_agent_found && c.status_active && !c.has_agent_uri) {
    return { cls: "pending", text: "Active · Pending URI Pin" };
  }
  if (c.on_chain_agent_found && c.status_active && c.has_agent_uri && !c.hash_matches_on_chain) {
    return { cls: "err", text: "Active · Card Hash Mismatch" };
  }
  return { cls: "err", text: "Badge Check Attention" };
}

async function verifyBadge() {
  ccdState.loading = true;
  ccdState.error = null;
  renderConcordiumViews();

  try {
    var badgePromise = fetch(CCD_BADGE_CHECK_URL, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Badge-check HTTP " + r.status);
      return r.json();
    });
    var cardPromise = fetchServedCardSha256(CCD_AGENT_CARD_URL).catch(function () {
      return fetchServedCardSha256("./.well-known/agent-card.json").catch(function () { return null; });
    });

    var results = await Promise.all([badgePromise, cardPromise]);
    ccdState.data = results[0];
    ccdState.servedSha256 = results[1];
    ccdState.checkedAt = new Date().toLocaleTimeString();
    ccdState.loading = false;

    if (ccdState.data && ccdState.data.badge_valid && ccdState.pollTimer) {
      clearInterval(ccdState.pollTimer);
      ccdState.pollTimer = null;
      ccdState.signKind = "ok";
      ccdState.signMessage = "On-chain verification confirmed! badge_valid = true and SHA-256 matches.";
    }
  } catch (err) {
    ccdState.loading = false;
    ccdState.error = err && err.message ? err.message : String(err);
  }
  renderConcordiumViews();
  return ccdState.data;
}

function buildConcordiumChecksHtml(d) {
  var c = (d && d.checks) || {};
  var items = [
    { label: "CIS-8004 Agent #1185", ok: !!c.on_chain_agent_found },
    { label: "Status: " + ((d && d.on_chain && d.on_chain.status) || "Unknown"), ok: !!c.status_active },
    { label: c.has_agent_uri ? "agent_uri Set" : "agent_uri Pending", ok: !!c.has_agent_uri },
    { label: c.hash_matches_on_chain ? "SHA-256 Match" : "SHA-256 Unpinned", ok: !!c.hash_matches_on_chain },
    { label: "A2A Extension Conformant", ok: !!c.extension_conformant },
    { label: "Verification Hints Present", ok: !!c.verification_present },
  ];
  return items.map(function (it) {
    return '<span class="ccd-check-pill ' + (it.ok ? "pass" : "warn") + '">' +
      (it.ok ? "✓ " : "• ") + esc(it.label) + "</span>";
  }).join("");
}

function buildConcordiumReceiptBlockHtml() {
  var d = ccdState.data;
  var summary = getCcdStatusSummary();
  var owner = (d && d.on_chain && d.on_chain.owner_account) || CCD_OWNER;
  var activeTx = ccdState.pinnedTxHash || CCD_REG_TX;

  return (
    '<div class="ccd-receipt-badge">' +
      '<div class="ccd-receipt-header">' +
        '<span class="ccd-receipt-title">' +
          ccdLogoSvg("ccd-logo") +
          '<span>Verified by Concordium</span>' +
        "</span>" +
        '<span class="ccd-status-pill ' + summary.cls + '">' + esc(summary.text) + "</span>" +
      "</div>" +
      '<div class="receipt-grid">' +
        '<div class="receipt-row"><span class="k">Agent Badge (CIS-8004)</span><span class="v"><a class="mono" href="' + CCD_BADGE_CHECK_URL + '" target="_blank" rel="noopener">' + CCD_BADGE_SHORT + " ↗</a> · Agent #" + CCD_TOKEN_ID + "</span></div>" +
        '<div class="receipt-row"><span class="k">Accountable Owner</span><span class="v mono"><a href="' + CCD_EXPLORER_ACCOUNT_URL + '" target="_blank" rel="noopener">' + esc(shortCcdAccount(owner)) + " ↗</a></span></div>" +
        '<div class="receipt-row"><span class="k">Registry Contract</span><span class="v mono"><a href="' + CCD_EXPLORER_CONTRACT_URL + '" target="_blank" rel="noopener">&lt;' + CCD_CONTRACT_INDEX + "," + CCD_CONTRACT_SUBINDEX + "&gt; (Testnet) ↗</a></span></div>" +
      "</div>" +
      '<div class="pay-box" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:0">' +
        '<a class="btn secondary sm" href="' + ccdExplorerTxUrl(activeTx) + '" target="_blank" rel="noopener">CCDExplorer Tx ↗</a>' +
        '<a class="btn secondary sm" href="' + CCD_CCDSCAN_TOKEN_URL + '" target="_blank" rel="noopener">CCDScan Agent #' + CCD_TOKEN_ID + " ↗</a>" +
        '<a class="btn secondary sm" href="' + CCD_AGENT_CARD_URL + '" target="_blank" rel="noopener">Agent Card JSON ↗</a>' +
        '<button type="button" class="btn secondary sm" id="ccd-copy-receipt-badge">Copy badge</button>' +
      "</div>" +
    "</div>"
  );
}

function buildConcordiumDashboardCardHtml() {
  var d = ccdState.data;
  var c = (d && d.checks) || {};
  var summary = getCcdStatusSummary();
  var owner = (d && d.on_chain && d.on_chain.owner_account) || CCD_OWNER;
  var onChainUri = (d && d.on_chain && d.on_chain.agent_uri) || null;
  var onChainHash = (d && d.on_chain && d.on_chain.metadata_hash_hex) || "—";
  var servedHash = ccdState.servedSha256 || (d && d.card_sha256) || "Checking…";
  var needsPin = !d || !d.badge_valid;

  var signSectionInner =
    '<div class="muted" style="margin-bottom:8px">' +
      'Pin the served Agent Card URL and SHA-256 hash on-chain via <code>CIS-8004.setAgentURI</code> so Concordium\'s registry displays <strong>BillSettle</strong> and <code>badge-check</code> returns <code>badge_valid: true</code>.' +
    "</div>" +
    '<div class="ccd-meta-grid">' +
      '<div class="ccd-meta-item"><span class="k">Agent Card URI</span><span class="v mono">' + esc(CCD_AGENT_CARD_URL) + "</span></div>" +
      '<div class="ccd-meta-item"><span class="k">Served Card SHA-256</span><span class="v mono">' + esc(servedHash) + "</span></div>" +
    "</div>" +
    '<div class="ccd-sign-actions">' +
      '<button type="button" class="btn sm" id="ccd-sign-mobile-btn"' + (ccdState.signBusy ? " disabled" : "") + ">Sign with Mobile Wallet (QR)</button>" +
      '<button type="button" class="btn secondary sm" id="ccd-sign-browser-btn"' + (ccdState.signBusy ? " disabled" : "") + ">Sign with Browser Wallet</button>" +
      '<a class="btn secondary sm" href="' + CCD_BUILD_SET_URI_URL + "?metadata_hash_hex=" + encodeURIComponent(servedHash !== "Checking…" ? servedHash : "") + "&agent_uri=" + encodeURIComponent(CCD_AGENT_CARD_URL) + "&sender=" + encodeURIComponent(CCD_OWNER) + '" target="_blank" rel="noopener">Inspect Payload JSON ↗</a>' +
    "</div>" +
    (ccdState.wcShowPanel
      ? '<div class="ccd-wc-panel" id="ccd-wc-panel">' +
          '<strong style="display:block;margin-bottom:4px">Concordium Mobile Wallet (WalletConnect · Testnet)</strong>' +
          '<div class="muted" style="font-size:12.5px">Scan with Concordium Wallet on your phone, approve connection, then confirm the <code>CIS-8004.setAgentURI</code> transaction.</div>' +
          '<div class="ccd-wc-qr-wrap"><canvas id="ccd-wc-qr-canvas"></canvas></div>' +
          (ccdState.wcUri
            ? '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px">' +
                '<a class="btn sm" id="ccd-wc-deeplink" href="' + esc(window.ConcordiumWC ? window.ConcordiumWC.getDeeplink(ccdState.wcUri, "testnet") : ccdState.wcUri) + '">Open in Concordium Wallet</a>' +
                '<button type="button" class="btn secondary sm" id="ccd-copy-wc-uri">Copy WalletConnect URI</button>' +
              "</div>"
            : '<div class="muted">Generating WalletConnect QR…</div>') +
        "</div>"
      : "") +
    (ccdState.signMessage
      ? '<div class="' + (ccdState.signKind === "err" ? "err" : (ccdState.signKind === "ok" ? "ok" : "warn")) + '" style="margin-bottom:0">' +
          esc(ccdState.signMessage) +
          (ccdState.pinnedTxHash
            ? '<br><span class="mono">Tx: ' + esc(ccdState.pinnedTxHash) + "</span> · " +
              '<a href="' + ccdScanTxUrl(ccdState.pinnedTxHash) + '" target="_blank" rel="noopener">CCDScan ↗</a> · ' +
              '<a href="' + ccdExplorerTxUrl(ccdState.pinnedTxHash) + '" target="_blank" rel="noopener">CCDExplorer ↗</a>'
            : "") +
        "</div>"
      : "");

  var anchorContainer = needsPin
    ? '<div class="ccd-anchor-box needs-pin">' +
        '<div style="font-weight:700;font-size:13.5px;margin-bottom:4px">Owner Action Required: Anchor Agent Card On-Chain (<code>setAgentURI</code>)</div>' +
        signSectionInner +
      "</div>"
    : '<details class="muted" style="margin-top:12px"><summary>Owner Action: Update anchored Agent Card (<code>setAgentURI</code>)</summary>' +
        '<div class="ccd-anchor-box">' + signSectionInner + "</div>" +
      "</details>";

  return (
    '<div class="card ccd-card">' +
      '<div class="ccd-head">' +
        '<div class="ccd-brand">' +
          ccdLogoSvg("ccd-logo lg") +
          "<div>" +
            '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
              "<h3>Verified by Concordium</h3>" +
              '<span class="ccd-status-pill ' + summary.cls + '">' + esc(summary.text) + "</span>" +
            "</div>" +
            '<div class="muted" style="font-size:12.5px">Live CIS-8004 accountability layer on Concordium Testnet (NEAR remains the bill-payment rail).</div>' +
          "</div>" +
        "</div>" +
        '<button type="button" class="btn secondary sm" id="ccd-reverify-btn"' + (ccdState.loading ? " disabled" : "") + ">" +
          (ccdState.loading ? "Checking…" : "Re-verify live") +
        "</button>" +
      "</div>" +
      '<div class="ccd-meta-grid">' +
        '<div class="ccd-meta-item"><span class="k">Badge String (Short · Base58Check)</span><span class="v mono">' +
          '<a href="' + CCD_BADGE_CHECK_URL + '" target="_blank" rel="noopener">' + CCD_BADGE_SHORT + " ↗</a>" +
          ' <button type="button" class="btn secondary sm" id="ccd-copy-dash-badge" style="padding:2px 8px;font-size:11px;margin-left:6px">Copy</button>' +
        "</span></div>" +
        '<div class="ccd-meta-item"><span class="k">Agent &amp; Registry (Testnet)</span><span class="v">Native Agent #' + CCD_TOKEN_ID + ' · CIS-8004 <span class="mono">&lt;' + CCD_CONTRACT_INDEX + "," + CCD_CONTRACT_SUBINDEX + "&gt;</span></span></div>" +
        '<div class="ccd-meta-item"><span class="k">Verified Human Owner</span><span class="v mono"><a href="' + CCD_EXPLORER_ACCOUNT_URL + '" target="_blank" rel="noopener">' + esc(owner) + " ↗</a></span></div>" +
        '<div class="ccd-meta-item"><span class="k">On-Chain Agent URI &amp; Hash</span><span class="v mono">' +
          (onChainUri ? esc(onChainUri) : '<span class="muted">Not anchored yet (Metadata URL: N/A)</span>') +
          '<br><span style="font-size:11px;color:var(--muted)">On-chain hash: ' + esc(onChainHash) + "</span>" +
        "</span></div>" +
      "</div>" +
      (d ? '<div class="ccd-checks">' + buildConcordiumChecksHtml(d) + "</div>" : "") +
      (ccdState.error ? '<div class="warn" style="margin-top:0">Live check error: ' + esc(ccdState.error) + "</div>" : "") +
      '<div class="ccd-links">' +
        '<a class="btn secondary sm" href="' + CCD_BADGE_CHECK_URL + '" target="_blank" rel="noopener">Live Badge-Check JSON ↗</a>' +
        '<a class="btn secondary sm" href="' + CCD_AGENT_CARD_URL + '" target="_blank" rel="noopener">Agent Card JSON ↗</a>' +
        '<a class="btn secondary sm" href="' + CCD_EXPLORER_TX_URL + '" target="_blank" rel="noopener">CCDExplorer Reg Tx ↗</a>' +
        '<a class="btn secondary sm" href="' + CCD_CCDSCAN_TOKEN_URL + '" target="_blank" rel="noopener">CCDScan Token #' + CCD_TOKEN_ID + " ↗</a>" +
        '<a class="btn secondary sm" href="' + CCD_REGISTRY_DASHBOARD_URL + '" target="_blank" rel="noopener">Registry Dashboard ↗</a>' +
      "</div>" +
      anchorContainer +
    "</div>"
  );
}

function wireConcordiumEvents() {
  bindCopy("ccd-copy-dash-badge", CCD_BADGE_SHORT, "Copy");
  bindCopy("ccd-copy-receipt-badge", CCD_BADGE_SHORT, "Copy badge");
  if (ccdState.wcUri) {
    bindCopy("ccd-copy-wc-uri", ccdState.wcUri, "Copy WalletConnect URI");
  }
  var reverifyBtn = document.getElementById("ccd-reverify-btn");
  if (reverifyBtn) {
    reverifyBtn.addEventListener("click", function () { verifyBadge(); });
  }
  var mobileBtn = document.getElementById("ccd-sign-mobile-btn");
  if (mobileBtn) {
    mobileBtn.addEventListener("click", function () { signSetAgentUriMobile(); });
  }
  var browserBtn = document.getElementById("ccd-sign-browser-btn");
  if (browserBtn) {
    browserBtn.addEventListener("click", function () { signSetAgentUriBrowser(); });
  }
}

function renderConcordiumViews() {
  var headerPill = document.getElementById("ccd-header-pill");
  if (headerPill) {
    var s = getCcdStatusSummary();
    headerPill.className = "ccd-status-pill " + s.cls;
    headerPill.textContent = s.text;
  }

  var dashHost = document.getElementById("ccd-dashboard-card");
  if (dashHost) {
    dashHost.innerHTML = buildConcordiumDashboardCardHtml();
    if (ccdState.wcShowPanel && ccdState.wcUri && window.ConcordiumWC) {
      var canvas = document.getElementById("ccd-wc-qr-canvas");
      if (canvas) {
        window.ConcordiumWC.renderQR(ccdState.wcUri, canvas).catch(function () {});
      }
    }
    wireConcordiumEvents();
  }

  var receiptHost = document.getElementById("ccd-receipt-badge");
  if (receiptHost) {
    receiptHost.innerHTML = buildConcordiumReceiptBlockHtml();
    bindCopy("ccd-copy-receipt-badge", CCD_BADGE_SHORT, "Copy badge");
  }
}

function loadWcBundle() {
  if (window.ConcordiumWC) return Promise.resolve(window.ConcordiumWC);
  return new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = "wc-bundle.js";
    script.onload = function () {
      if (window.ConcordiumWC) resolve(window.ConcordiumWC);
      else reject(new Error("ConcordiumWC did not initialize."));
    };
    script.onerror = function () {
      reject(new Error("Could not load wc-bundle.js."));
    };
    document.head.appendChild(script);
  });
}

async function buildSetAgentUriPayload(senderAccount) {
  var sha256Hex = await fetchServedCardSha256(CCD_AGENT_CARD_URL);
  ccdState.servedSha256 = sha256Hex;
  var url = CCD_BUILD_SET_URI_URL +
    "?metadata_hash_hex=" + encodeURIComponent(sha256Hex) +
    "&agent_uri=" + encodeURIComponent(CCD_AGENT_CARD_URL) +
    "&sender=" + encodeURIComponent(senderAccount);
  var res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("build-set-agent-uri HTTP " + res.status);
  return await res.json();
}

function startCcdPinPolling() {
  if (ccdState.pollTimer) clearInterval(ccdState.pollTimer);
  var tries = 0;
  ccdState.pollTimer = setInterval(function () {
    tries += 1;
    verifyBadge().then(function (data) {
      if ((data && data.badge_valid) || tries >= 18) {
        clearInterval(ccdState.pollTimer);
        ccdState.pollTimer = null;
      }
    });
  }, 4000);
}

async function signSetAgentUriMobile() {
  if (ccdState.signBusy) return;
  ccdState.signBusy = true;
  ccdState.wcShowPanel = true;
  ccdState.wcUri = null;
  ccdState.pinnedTxHash = null;
  ccdState.signKind = "warn";
  ccdState.signMessage = "Preparing WalletConnect pairing & computing live card SHA-256…";
  renderConcordiumViews();

  try {
    var wc = await loadWcBundle();
    var built = await buildSetAgentUriPayload(CCD_OWNER);
    ccdState.signMessage = "Scan the QR code with Concordium Mobile Wallet (Testnet) and approve connection…";
    renderConcordiumViews();

    await wc.connectMobile({
      projectId: CCD_WC_PROJECT_ID,
      network: "testnet",
      autoDetect: false,
      onUri: function (uri) {
        ccdState.wcUri = uri;
        renderConcordiumViews();
      },
      onConnected: async function (account, _genesis, session, activeClient) {
        try {
          if (account !== CCD_OWNER) {
            throw new Error("Connected account " + account + " is not the registered owner (" + CCD_OWNER + "). Switch to the owner account in Mobile Wallet.");
          }
          ccdState.signKind = "warn";
          ccdState.signMessage = "Connected " + shortCcdAccount(account) + ". Check your phone and approve CIS-8004.setAgentURI…";
          renderConcordiumViews();

          var chains = session && session.namespaces && session.namespaces.ccd && session.namespaces.ccd.chains;
          var chainId = (chains && chains[0]) || "ccd:testnet";
          var payloadJson = JSON.stringify({
            amount: "0",
            address: { index: CCD_CONTRACT_INDEX, subIndex: CCD_CONTRACT_SUBINDEX },
            receiveName: "CIS-8004.setAgentURI",
            maxContractExecutionEnergy: 30000,
            message: built.parameter_hex,
          });
          var result = await activeClient.request({
            topic: session.topic,
            chainId: chainId,
            request: {
              method: "sign_and_send_transaction",
              params: {
                type: "Update",
                sender: account,
                payload: payloadJson,
                schema: CCD_REGISTRY_SCHEMA_B64,
              },
            },
          });
          var txHash = (typeof result === "string" ? result : (result && result.hash) || "").trim().replace(/^0x/, "");
          if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
            throw new Error("Mobile Wallet returned unexpected response: " + JSON.stringify(result));
          }
          ccdState.signBusy = false;
          ccdState.wcShowPanel = false;
          ccdState.pinnedTxHash = txHash;
          ccdState.signKind = "ok";
          ccdState.signMessage = "Transaction submitted! Waiting for Concordium finality and re-verifying badge…";
          renderConcordiumViews();
          startCcdPinPolling();
        } catch (innerErr) {
          ccdState.signBusy = false;
          ccdState.signKind = "err";
          ccdState.signMessage = innerErr && innerErr.message ? innerErr.message : String(innerErr);
          renderConcordiumViews();
        }
      },
      onError: function (msg) {
        ccdState.signBusy = false;
        ccdState.signKind = "err";
        ccdState.signMessage = "WalletConnect error: " + (msg || "Connection failed or cancelled.");
        renderConcordiumViews();
      },
    });
  } catch (err) {
    ccdState.signBusy = false;
    ccdState.signKind = "err";
    ccdState.signMessage = err && err.message ? err.message : String(err);
    renderConcordiumViews();
  }
}

async function detectBrowserWalletProvider(timeoutMs) {
  if (window.concordium) return window.concordium;
  return await new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      if (window.concordium) resolve(window.concordium);
      else reject(new Error("Concordium Browser Wallet extension not detected. Use Mobile Wallet (QR) or unlock the Chrome extension."));
    }, timeoutMs || 2500);
    window.addEventListener("concordium#initialized", function () {
      if (done || !window.concordium) return;
      done = true;
      clearTimeout(timer);
      resolve(window.concordium);
    }, { once: true });
  });
}

async function signSetAgentUriBrowser() {
  if (ccdState.signBusy) return;
  ccdState.signBusy = true;
  ccdState.wcShowPanel = false;
  ccdState.pinnedTxHash = null;
  ccdState.signKind = "warn";
  ccdState.signMessage = "Connecting to Concordium Browser Wallet…";
  renderConcordiumViews();

  try {
    var provider = await detectBrowserWalletProvider(2500);
    var accounts = typeof provider.requestAccounts === "function" ? await provider.requestAccounts() : [];
    var account = (typeof provider.getMostRecentlySelectedAccount === "function" ? await provider.getMostRecentlySelectedAccount() : null) || accounts[0];
    if (!account) throw new Error("No account connected in Concordium Browser Wallet.");
    if (account !== CCD_OWNER) {
      throw new Error("Selected account " + account + " is not the agent owner (" + CCD_OWNER + "). Switch accounts in the Browser Wallet.");
    }
    if (typeof provider.getSelectedChain === "function") {
      var chain = await provider.getSelectedChain();
      if (chain && chain !== CCD_TESTNET_GENESIS) {
        throw new Error("Browser Wallet is not on Concordium Testnet. Please switch to Testnet and try again.");
      }
    }

    ccdState.signMessage = "Computing live card SHA-256 and preparing CIS-8004.setAgentURI…";
    renderConcordiumViews();

    var results = await Promise.all([
      buildSetAgentUriPayload(account),
      import(CCD_WEB_SDK_CDN),
    ]);
    var built = results[0];
    var sdk = results[1];

    ccdState.signMessage = "Approve the CIS-8004.setAgentURI transaction in Concordium Browser Wallet…";
    renderConcordiumViews();

    var txHash = await provider.sendTransaction(
      account,
      sdk.AccountTransactionType.Update,
      {
        amount: sdk.CcdAmount.fromMicroCcd(0n),
        address: sdk.ContractAddress.create(BigInt(CCD_CONTRACT_INDEX), BigInt(CCD_CONTRACT_SUBINDEX)),
        receiveName: sdk.ReceiveName.fromString("CIS-8004.setAgentURI"),
        maxContractExecutionEnergy: sdk.Energy.create(30000n),
      },
      built.parameter_json,
      { type: "module", value: CCD_REGISTRY_SCHEMA_B64 }
    );

    ccdState.signBusy = false;
    ccdState.pinnedTxHash = String(txHash || "").trim().replace(/^0x/, "");
    ccdState.signKind = "ok";
    ccdState.signMessage = "Transaction submitted! Waiting for Concordium finality and re-verifying badge…";
    renderConcordiumViews();
    startCcdPinPolling();
  } catch (err) {
    ccdState.signBusy = false;
    ccdState.signKind = "err";
    ccdState.signMessage = err && err.message ? err.message : String(err);
    renderConcordiumViews();
  }
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
    '<div id="ccd-dashboard-card"></div>' +
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
  renderConcordiumViews();

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
        : "") +
      '<div id="ccd-receipt-badge">' + buildConcordiumReceiptBlockHtml() + "</div>"
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
      pre + "</details>" +
      '<div id="ccd-receipt-badge">' + buildConcordiumReceiptBlockHtml() + "</div>"
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
    "<p class='muted' style='margin:10px 0 0'>Mock BSDD on NEAR testnet (6 decimals, no real money).</p>" +
    '<div id="ccd-receipt-badge">' + buildConcordiumReceiptBlockHtml() + "</div>"
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
  bindCopy("ccd-copy-receipt-badge", CCD_BADGE_SHORT, "Copy badge");
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
verifyBadge();
