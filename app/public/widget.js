/*!
 * Kapora Protocol — embeddable deposit button (vanilla JS, no dependencies).
 *
 * Usage:
 *   <script src="https://<kapora-app>/widget.js"
 *           data-platform="<PLATFORM_PUBKEY>"
 *           data-listing-id="abc123"
 *           data-amount="2000"            (amount in PLN the payer locks; demo rate 1 USDC ~ 1 PLN)
 *           data-template="deposit"       (deposit | rental | freelance | purchase; legacy car/property → deposit)
 *           data-app-url="https://..."    (optional; defaults to this script's origin)
 *           data-mode="modal"             (optional; "modal" (default) or "tab")
 *           data-target="#css-selector"   (optional; where to render; defaults to right after the script tag)
 *           data-label="..."></script>    (optional; custom button text)
 *
 * Clicking the button opens `${appUrl}/d/new?platform=..&listing=..&amount=..&template=..`
 * in a modal iframe overlay (default) or a new tab.
 *
 * Programmatic API: window.Kapora.mount(element, { platform, listingId, amount, template, appUrl, mode })
 */
(function () {
  "use strict";

  var BRAND_GRADIENT = "linear-gradient(135deg, #8b5cf6 0%, #6366f1 45%, #14f195 100%)";

  function scriptOrigin(script) {
    try {
      return new URL(script.src, window.location.href).origin;
    } catch (e) {
      return window.location.origin;
    }
  }

  function buildUrl(opts, embed) {
    var base = String(opts.appUrl || window.location.origin).replace(/\/+$/, "");
    var params = new URLSearchParams();
    if (opts.platform) params.set("platform", opts.platform);
    if (opts.listingId) params.set("listing", opts.listingId);
    if (opts.amount) params.set("amount", opts.amount);
    if (opts.template) params.set("template", opts.template);
    if (embed) params.set("embed", "1");
    return base + "/d/new?" + params.toString();
  }

  var TEMPLATES = {
    deposit: { label: "Pay deposit safely with Kapora", noun: "deposit" },
    rental: { label: "Pay security deposit with Kapora", noun: "security deposit" },
    freelance: { label: "Pay the fee safely with Kapora", noun: "fee" },
    purchase: { label: "Buy safely with Kapora", noun: "price" },
  };
  /** Current template keys plus legacy values (car, property, item → deposit). */
  function normalizeTemplate(t) {
    t = String(t || "").toLowerCase();
    return TEMPLATES[t] ? t : "deposit";
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatAmount(amount) {
    var n = Number(amount);
    if (!isFinite(n) || n <= 0) return "";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " PLN";
  }

  var SHIELD_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>' +
    '<path d="m9 12 2 2 4-4"/></svg>';

  var BUTTON_CSS =
    ":host{all:initial;display:block;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
    ".kp-wrap{display:flex;flex-direction:column;gap:8px;max-width:420px}" +
    ".kp-btn{display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border:0;border-radius:14px;text-align:left;" +
    "background:" + BRAND_GRADIENT + ";color:#fff;cursor:pointer;font-family:inherit;" +
    "box-shadow:0 10px 30px -10px rgba(99,102,241,.7),inset 0 1px 0 rgba(255,255,255,.25);transition:transform .15s ease,box-shadow .15s ease,filter .15s ease}" +
    ".kp-btn:hover{transform:translateY(-1px);filter:brightness(1.06);box-shadow:0 14px 36px -10px rgba(99,102,241,.85),inset 0 1px 0 rgba(255,255,255,.3)}" +
    ".kp-btn:active{transform:translateY(0)}" +
    ".kp-btn:focus-visible{outline:3px solid rgba(20,241,149,.6);outline-offset:2px}" +
    ".kp-ico{flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.18)}" +
    ".kp-txt{display:flex;flex-direction:column;min-width:0;line-height:1.25}" +
    ".kp-main{font-size:15px;font-weight:700;letter-spacing:.005em}" +
    ".kp-sub{font-size:12px;font-weight:500;opacity:.88;margin-top:2px}" +
    ".kp-arrow{margin-left:auto;flex:none;font-size:18px;opacity:.85}" +
    ".kp-note{display:flex;align-items:center;gap:6px;font-size:12px;line-height:1.4;color:#64748b}" +
    ".kp-dot{width:6px;height:6px;border-radius:999px;background:#14f195;flex:none;box-shadow:0 0 0 3px rgba(20,241,149,.18)}" +
    ".kp-note b{color:#334155;font-weight:600}";

  var OVERLAY_CSS =
    ".kp-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;" +
    "background:rgba(2,6,23,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:kp-fade .18s ease-out}" +
    ".kp-modal{position:relative;width:min(760px,100%);height:min(860px,100%);border-radius:20px;overflow:hidden;background:#07080d;" +
    "box-shadow:0 40px 120px -20px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.08);display:flex;flex-direction:column;animation:kp-pop .22s cubic-bezier(.2,.9,.3,1.2)}" +
    ".kp-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px 10px 16px;background:#0d0f17;border-bottom:1px solid rgba(255,255,255,.07);" +
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#e2e8f0;font-size:13px}" +
    ".kp-brand{display:flex;align-items:center;gap:8px;font-weight:700}" +
    ".kp-logo{width:22px;height:22px;border-radius:7px;background:" + BRAND_GRADIENT + ";display:flex;align-items:center;justify-content:center;color:#fff}" +
    ".kp-sub{color:#64748b;font-weight:500}" +
    ".kp-actions{display:flex;align-items:center;gap:6px}" +
    ".kp-link,.kp-close{display:inline-flex;align-items:center;justify-content:center;height:32px;border-radius:9px;border:1px solid rgba(255,255,255,.1);" +
    "background:rgba(255,255,255,.04);color:#cbd5e1;font-size:12px;font-weight:600;text-decoration:none;cursor:pointer;padding:0 10px;transition:background .15s}" +
    ".kp-close{width:32px;padding:0;font-size:18px;line-height:1}" +
    ".kp-link:hover,.kp-close:hover{background:rgba(255,255,255,.1);color:#fff}" +
    ".kp-frame{flex:1;width:100%;border:0;background:#07080d}" +
    "@keyframes kp-fade{from{opacity:0}to{opacity:1}}" +
    "@keyframes kp-pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}" +
    "@media (max-width:640px){.kp-overlay{padding:0}.kp-modal{border-radius:0;height:100%}.kp-sub{display:none}}";

  var overlayStylesInjected = false;
  function injectOverlayStyles() {
    if (overlayStylesInjected) return;
    var style = document.createElement("style");
    style.setAttribute("data-kapora", "overlay");
    style.textContent = OVERLAY_CSS;
    document.head.appendChild(style);
    overlayStylesInjected = true;
  }

  var activeOverlay = null;
  function closeModal() {
    if (!activeOverlay) return;
    activeOverlay.remove();
    activeOverlay = null;
    document.documentElement.style.overflow = "";
    document.removeEventListener("keydown", onKeyDown);
  }
  function onKeyDown(e) {
    if (e.key === "Escape") closeModal();
  }

  function openModal(opts) {
    closeModal();
    injectOverlayStyles();
    var overlay = document.createElement("div");
    overlay.className = "kp-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Kapora secure deposit");

    var modal = document.createElement("div");
    modal.className = "kp-modal";

    var bar = document.createElement("div");
    bar.className = "kp-bar";
    bar.innerHTML =
      '<div class="kp-brand"><span class="kp-logo">' + SHIELD_SVG.replace(/18/g, "14") + "</span>Kapora" +
      '<span class="kp-sub">&middot; secure deposit on Solana devnet</span></div>';

    var actions = document.createElement("div");
    actions.className = "kp-actions";
    var tabLink = document.createElement("a");
    tabLink.className = "kp-link";
    tabLink.href = buildUrl(opts, false);
    tabLink.target = "_blank";
    tabLink.rel = "noopener";
    tabLink.textContent = "Open in new tab ↗";
    tabLink.addEventListener("click", closeModal);
    var closeBtn = document.createElement("button");
    closeBtn.className = "kp-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", closeModal);
    actions.appendChild(tabLink);
    actions.appendChild(closeBtn);
    bar.appendChild(actions);

    var frame = document.createElement("iframe");
    frame.className = "kp-frame";
    frame.src = buildUrl(opts, true);
    frame.title = "Kapora deposit";
    frame.allow = "clipboard-write";

    modal.appendChild(bar);
    modal.appendChild(frame);
    overlay.appendChild(modal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    activeOverlay = overlay;
  }

  function mount(target, opts) {
    if (!target) return null;
    var host = document.createElement("div");
    host.setAttribute("data-kapora-widget", "");
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

    var style = document.createElement("style");
    style.textContent = BUTTON_CSS;
    root.appendChild(style);

    var wrap = document.createElement("div");
    wrap.className = "kp-wrap";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kp-btn";
    var amt = formatAmount(opts.amount);
    btn.innerHTML =
      '<span class="kp-ico">' + SHIELD_SVG + "</span>" +
      '<span class="kp-txt"><span class="kp-main">' + escapeHtml(opts.label || TEMPLATES[opts.template].label) + "</span>" +
      '<span class="kp-sub">' + (amt ? escapeHtml(amt) + " " + TEMPLATES[opts.template].noun + " &middot; " : "") + "held by a smart contract</span></span>" +
      '<span class="kp-arrow" aria-hidden="true">&rarr;</span>';
    btn.addEventListener("click", function () {
      if (opts.mode === "tab") {
        window.open(buildUrl(opts, false), "_blank", "noopener");
      } else {
        openModal(opts);
      }
    });
    var note = document.createElement("div");
    note.className = "kp-note";
    note.innerHTML =
      '<span class="kp-dot"></span><span>Both sides lock funds in a smart contract. <b>No middleman holds your money.</b></span>';

    wrap.appendChild(btn);
    wrap.appendChild(note);
    root.appendChild(wrap);
    target.appendChild(host);
    return host;
  }

  function optionsFromScript(script) {
    var d = script.dataset || {};
    return {
      platform: d.platform || "",
      listingId: d.listingId || "",
      amount: d.amount || "",
      template: normalizeTemplate(d.template),
      appUrl: d.appUrl || scriptOrigin(script),
      mode: d.mode === "tab" ? "tab" : "modal",
      label: d.label || "",
    };
  }

  function mountFromScript(script) {
    if (!script || script.getAttribute("data-kapora-mounted")) return;
    script.setAttribute("data-kapora-mounted", "1");
    var opts = optionsFromScript(script);
    var target = null;
    if (script.dataset && script.dataset.target) target = document.querySelector(script.dataset.target);
    if (target) {
      mount(target, opts);
    } else {
      // Render right after the script tag.
      var anchor = document.createElement("div");
      script.parentNode.insertBefore(anchor, script.nextSibling);
      mount(anchor, opts);
    }
  }

  // Messages from the embedded Kapora app (same protocol for any origin, payload is non-sensitive).
  window.addEventListener("message", function (e) {
    var msg = e && e.data;
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
    if (msg.type === "kapora:close") closeModal();
  });

  window.Kapora = window.Kapora || {};
  window.Kapora.mount = function (el, opts) {
    var o = opts || {};
    return mount(typeof el === "string" ? document.querySelector(el) : el, {
      platform: o.platform || "",
      listingId: o.listingId || "",
      amount: o.amount != null ? String(o.amount) : "",
      template: normalizeTemplate(o.template),
      appUrl: o.appUrl || window.location.origin,
      mode: o.mode === "tab" ? "tab" : "modal",
      label: o.label || "",
    });
  };
  window.Kapora.close = closeModal;

  var current = document.currentScript;
  if (current) {
    mountFromScript(current);
  } else {
    // Fallback for environments where currentScript is unavailable.
    var scripts = document.querySelectorAll('script[src*="widget.js"][data-listing-id]');
    for (var i = 0; i < scripts.length; i++) mountFromScript(scripts[i]);
  }
})();
