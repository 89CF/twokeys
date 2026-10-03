// Records the captioned Kapora demo video (≤ 2:55) with Playwright, driven through the real UI on Solana devnet.
//
//   pnpm --filter @kapora/app start            (terminal 1, app on :3000)
//   node e2e/record-video.mjs                  (terminal 2)  ->  ../pitch/demo-video.webm
//
// Env: BASE_URL (default http://localhost:3000), BROWSER_CHANNEL (msedge|chrome), HD=1 (1920x1080 instead of 1280x720),
//      SNAP_DIR (save key-frame PNGs for review), NOSHOW_SECS (deal-2 deadline after reserve, default 110).
//
// Before recording, an unrecorded browser context prepares "Deal 2" (buyer reserved + confirmed, seller never confirms,
// short deadline) and a DemoRent offer, so the "anyone applies the outcome" scene happens live without dead time.
// Demo accounts are reused from e2e/.state.json (created by the E2E run) and only funded if balances are low.

import { chromium } from "playwright";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(HERE, "..");
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const ORIGIN = new URL(BASE).origin;
const HD = !!process.env.HD;
const SIZE = HD ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
const OUT = path.join(APP, "..", "pitch", "demo-video.webm");
const VIDEO_DIR = path.join(HERE, ".video");
const SNAP_DIR = process.env.SNAP_DIR || "";
const NOSHOW_SECS = Number(process.env.NOSHOW_SECS || 110);
const NAMES = { seller: "Demo Seller", buyer: "Demo Buyer", visitor: "Demo Visitor" };
const DEAL_URL_RE = /\/d\/(?!new\b)([1-9A-HJ-NP-Za-km-z]{32,44})(?:[?#]|$)/;
const ERROR_TOAST = '[data-sonner-toast][data-type="error"]';

const env = Object.fromEntries(
  readFileSync(path.join(APP, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const PROGRAM_ID = env.NEXT_PUBLIC_PROGRAM_ID || "AkQXPVXUYDqyNUVNAsYGYXy9sHQR636xcuJbAJkiJe5F";

const t0 = Date.now();
const log = (...a) => console.log(`[video +${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Demo accounts: reuse keys from the E2E state (re-homed to BASE's origin), fund only if low.
// ---------------------------------------------------------------------------
function loadDemoKeys() {
  const file = path.join(HERE, ".state.json");
  if (!existsSync(file)) throw new Error("e2e/.state.json not found: run `pnpm --filter @kapora/app e2e` once to create demo accounts.");
  const st = JSON.parse(readFileSync(file, "utf8"));
  const items = new Map();
  for (const o of st.origins ?? []) for (const it of o.localStorage ?? []) if (it.name.startsWith("kapora:demo-wallet:")) items.set(it.name, it.value);
  return items;
}

function storageState(keys, walletName) {
  const localStorage = [...keys].map(([name, value]) => ({ name, value }));
  localStorage.push({ name: "walletName", value: JSON.stringify(walletName) });
  return { cookies: [], origins: [{ origin: ORIGIN, localStorage }] };
}

async function ensureFunds(keys) {
  const conn = new Connection(env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const mint = new PublicKey(env.NEXT_PUBLIC_USDC_MINT);
  const need = { seller: 2000, buyer: 2800, visitor: 0 };
  for (const who of ["seller", "buyer", "visitor"]) {
    const raw = keys.get(`kapora:demo-wallet:${who}`);
    if (!raw) throw new Error(`demo account ${who} missing in e2e/.state.json`);
    const pk = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw))).publicKey;
    const sol = (await conn.getBalance(pk)) / 1e9;
    const usdc = await conn
      .getTokenAccountBalance(getAssociatedTokenAddressSync(mint, pk))
      .then((r) => r.value.uiAmount ?? 0)
      .catch(() => 0);
    log(`${NAMES[who]} ${pk.toBase58()}: ${sol.toFixed(4)} SOL, ${usdc} USDC`);
    if (usdc < need[who] || sol < 0.012) {
      const res = await fetch(`${BASE}/api/faucet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: pk.toBase58() }) });
      log(`  funded ${NAMES[who]}: ${res.status} ${JSON.stringify(await res.json()).slice(0, 140)}`);
      await sleep(1500);
    }
  }
}

// ---------------------------------------------------------------------------
// On-page overlays: caption bar + visible cursor (re-injected after every navigation).
// ---------------------------------------------------------------------------
const OVERLAY_INIT = () => {
  if (window.top !== window) return; // only the top-level page gets the caption bar and cursor
  const css = `
    #kp-cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;max-width:min(1120px,92vw);
      display:flex;align-items:center;gap:14px;padding:14px 22px;border-radius:18px;background:rgba(7,8,13,.86);
      border:1px solid rgba(255,255,255,.12);box-shadow:0 20px 60px -10px rgba(0,0,0,.7);backdrop-filter:blur(8px);
      font-family:"Segoe UI",system-ui,-apple-system,sans-serif;color:#f8fafc;pointer-events:none;transition:opacity .35s}
    #kp-cap .st{flex:none;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#14f195;
      padding:5px 10px;border-radius:999px;background:rgba(20,241,149,.12);border:1px solid rgba(20,241,149,.3)}
    #kp-cap .tx{font-size:22px;font-weight:600;line-height:1.3}
    #kp-cap.hide{opacity:0}
    #kp-cur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;
      transition:transform .55s cubic-bezier(.3,.8,.3,1);filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
    #kp-cur.click::after{content:"";position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:999px;
      border:3px solid #14f195;animation:kpclick .45s ease-out}
    @keyframes kpclick{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
    [data-sonner-toaster]{display:none!important}
    html{scrollbar-width:none} ::-webkit-scrollbar{display:none}`;
  const mount = () => {
    if (document.getElementById("kp-cap")) return;
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    const cap = document.createElement("div");
    cap.id = "kp-cap";
    cap.className = "hide";
    cap.innerHTML = '<span class="st"></span><span class="tx"></span>';
    document.body.appendChild(cap);
    const cur = document.createElement("div");
    cur.id = "kp-cur";
    cur.innerHTML =
      '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l16 9.5-7 1.6L9.6 20z" fill="#fff" stroke="#0b0f19" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const s = window.__kpState || {};
    if (s.text) window.__kpCaption(s.step, s.text);
    if (s.x !== undefined) window.__kpCursor(s.x, s.y, false);
  };
  window.__kpCaption = (step, text) => {
    window.__kpState = { ...(window.__kpState || {}), step, text };
    const cap = document.getElementById("kp-cap");
    if (!cap) return;
    if (!text) return cap.classList.add("hide");
    cap.querySelector(".st").textContent = step || "";
    cap.querySelector(".st").style.display = step ? "" : "none";
    cap.querySelector(".tx").textContent = text;
    cap.classList.remove("hide");
  };
  window.__kpCursor = (x, y, animate = true) => {
    window.__kpState = { ...(window.__kpState || {}), x, y };
    const cur = document.getElementById("kp-cur");
    if (!cur) return;
    if (!animate) cur.style.transition = "none";
    cur.style.transform = `translate(${x}px, ${y}px)`;
    if (!animate) requestAnimationFrame(() => (cur.style.transition = ""));
  };
  window.__kpClick = () => {
    const cur = document.getElementById("kp-cur");
    if (!cur) return;
    cur.classList.remove("click");
    void cur.offsetWidth;
    cur.classList.add("click");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
};

function makeDirector(page) {
  const state = { step: "", text: "", x: SIZE.width / 2, y: SIZE.height / 2 };
  const reapply = () =>
    page
      .evaluate((s) => {
        window.__kpState = s;
        window.__kpCaption?.(s.step, s.text);
        window.__kpCursor?.(s.x, s.y, false);
      }, state)
      .catch(() => undefined);
  page.on("domcontentloaded", () => void reapply());
  page.on("load", () => void reapply());

  const d = {
    async caption(step, text, holdMs = 0) {
      state.step = step;
      state.text = text;
      log(`caption [${step}] ${text}`);
      captions.push(`[${step}] ${text}`);
      await reapply();
      if (holdMs) await page.waitForTimeout(holdMs);
    },
    async hold(ms) {
      await page.waitForTimeout(ms);
    },
    async moveTo(locator) {
      await locator.waitFor({ state: "visible", timeout: 60_000 });
      await locator.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })).catch(() => undefined);
      await page.waitForTimeout(650);
      const box = await locator.boundingBox();
      if (!box) return;
      state.x = box.x + Math.min(box.width / 2, 60);
      state.y = box.y + box.height / 2;
      await page.evaluate(({ x, y }) => window.__kpCursor?.(x, y), state).catch(() => undefined);
      await page.waitForTimeout(600);
    },
    async click(locator) {
      await d.moveTo(locator);
      await page.evaluate(() => window.__kpClick?.()).catch(() => undefined);
      await locator.click();
      await page.waitForTimeout(250);
    },
    async scrollTo(locator) {
      await locator.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })).catch(() => undefined);
      await page.waitForTimeout(900);
    },
    async scrollTop() {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await page.waitForTimeout(700);
    },
    async snap(name) {
      if (!SNAP_DIR) return;
      mkdirSync(SNAP_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`) }).catch(() => undefined);
    },
  };
  return d;
}

const captions = [];

// ---------------------------------------------------------------------------
// UI helpers shared by prep + recording
// ---------------------------------------------------------------------------
async function actAs(page, who, d) {
  const name = NAMES[who];
  const sw = page.getByTestId("wallet-switcher");
  await sw.waitFor({ state: "visible", timeout: 30_000 });
  if ((await sw.getAttribute("data-wallet")) === name && (await sw.getAttribute("data-connected")) === "true") return;
  if (d) {
    await d.click(sw);
    await page.waitForTimeout(500);
    await d.click(page.getByTestId(`switch-demo-${who}`));
  } else {
    await sw.click();
    await page.getByTestId(`switch-demo-${who}`).click();
  }
  await page.locator(`[data-testid="wallet-switcher"][data-wallet="${name}"][data-connected="true"]`).waitFor({ timeout: 20_000 });
}

async function txStep(page, label, click, done, timeout = 120_000) {
  // Public devnet RPCs rate-limit bursts (HTTP 429): wait and press the button again (max 3 attempts).
  for (let attempt = 1; ; attempt++) {
    const before = await page.locator(ERROR_TOAST).count();
    log(`${label}…${attempt > 1 ? ` (retry ${attempt - 1})` : ""}`);
    await click();
    const start = Date.now();
    let err = null;
    while (Date.now() - start < timeout) {
      if (await done()) return log(`${label}: ok`);
      if ((await page.locator(ERROR_TOAST).count()) > before) {
        err = (await page.locator(ERROR_TOAST).last().innerText()).replace(/\s+/g, " ").trim();
        break;
      }
      await page.waitForTimeout(400);
    }
    if (!err) throw new Error(`${label}: timed out`);
    if (attempt >= 3 || !/429|rate limit|Too Many|blockhash|expired/i.test(err)) throw new Error(`${label} failed: ${err}`);
    log(`  ${label}: transient error (${err.slice(0, 80)}), retrying in 5s`);
    await page.waitForTimeout(5000);
    if (await done()) return log(`${label}: ok`);
  }
}

const statusIs = (page, s) => async () => (await page.locator(`[data-testid="deal-status"][data-status="${s}"]`).count()) > 0;
const role = (page, r) => page.locator(`[data-testid="role-pill"][data-role="${r}"]`).waitFor({ timeout: 30_000 });

async function createOfferPrep(page, query, windows = {}) {
  await page.goto(`${BASE}/d/new?${new URLSearchParams(query)}`);
  await actAs(page, "seller");
  for (const [k, v] of Object.entries(windows)) await page.getByTestId(`window-${k}`).fill(String(v));
  const submit = page.getByTestId("create-offer-submit");
  await page.waitForFunction(() => !document.querySelector('[data-testid="create-offer-submit"]')?.hasAttribute("disabled"), null, { timeout: 30_000 });
  await txStep(page, `prep: create ${query.listing}`, () => submit.click(), async () => DEAL_URL_RE.test(page.url()));
  await page.locator('[data-testid="deal-status"][data-status="offered"]').waitFor({ timeout: 60_000 });
  return page.url().split("?")[0];
}

// ---------------------------------------------------------------------------
// Full-screen title / closing cards
// ---------------------------------------------------------------------------
const CARD_CSS = `
  *{box-sizing:border-box;margin:0}
  body{width:100vw;height:100vh;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;color:#f8fafc;
    background:radial-gradient(circle at 25% -10%,rgba(139,92,246,.45),transparent 55%),radial-gradient(circle at 100% 110%,rgba(20,241,149,.22),transparent 50%),#07080d}
  .grid{position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:48px 48px}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 9vw}
  .logo{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:700}
  .mark{width:58px;height:58px;border-radius:17px;background:linear-gradient(135deg,#8b5cf6,#6366f1 45%,#14f195);display:flex;align-items:center;justify-content:center;box-shadow:0 16px 40px -10px rgba(99,102,241,.8)}
  h1{margin-top:34px;font-size:64px;line-height:1.05;letter-spacing:-.03em;font-weight:700}
  .grad{background:linear-gradient(90deg,#c4b5fd,#818cf8 40%,#5eead4 75%,#14f195);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin-top:26px;font-size:25px;line-height:1.45;color:#cbd5e1;max-width:1000px}
  .fade{opacity:0;animation:fade .8s ease-out forwards}
  .d1{animation-delay:1.6s}.d2{animation-delay:3.4s}.d3{animation-delay:5.2s}
  @keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .pills{display:flex;gap:12px;margin-top:34px;flex-wrap:wrap}
  .pill{padding:10px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);font-size:18px;font-weight:600}
  .mint{color:#14f195;border-color:rgba(20,241,149,.35);background:rgba(20,241,149,.08)}
  code{font-family:Consolas,monospace;font-size:19px;color:#e2e8f0}`;
const MARK = `<span class="mark"><svg viewBox="0 0 32 32" width="38" height="38" fill="none"><path d="M16 3.5c3.2 2.2 6.6 3.3 10 3.4v8.3c0 6.6-4.2 11.1-10 13.3C10.2 26.3 6 21.8 6 15.2V6.9c3.4-.1 6.8-1.2 10-3.4Z" stroke="white" stroke-width="2.4" stroke-linejoin="round"/><circle cx="13" cy="15.5" r="3.6" stroke="white" stroke-width="2.2"/><circle cx="19" cy="15.5" r="3.6" stroke="white" stroke-width="2.2"/></svg></span>`;

const TITLE_HTML = `<html><head><style>${CARD_CSS}</style></head><body><div class="grid"></div><div class="wrap">
  <div class="logo">${MARK} Kapora Protocol</div>
  <h1>You can disappear,<br><span class="grad">but not with my money.</span></h1>
  <p class="fade d1">You find a car online. The seller asks for a deposit by bank transfer, then disappears.</p>
  <p class="fade d2">Polish law already has the rule (zadatek, Civil Code art. 394): if the seller backs out, they pay back double. But nobody goes to court over a deposit.</p>
  <div class="pills fade d3"><span class="pill mint">Finance without intermediaries</span><span class="pill">Solana devnet · live demo</span></div>
</div></body></html>`;

const CLOSING_HTML = `<html><head><style>${CARD_CSS}</style></head><body><div class="grid"></div><div class="wrap">
  <div class="logo">${MARK} Kapora Protocol</div>
  <h1>One component.<br><span class="grad">Every marketplace, every sector, every country.</span></h1>
  <p class="fade d1">Every rule that moves money lives in the on-chain program. No admin instruction, no custody, no fees.</p>
  <div class="pills fade d1"><span class="pill mint">Solana devnet · Anchor · open source</span><span class="pill"><code>${PROGRAM_ID}</code></span></div>
</div></body></html>`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function launch() {
  const channels = process.env.BROWSER_CHANNEL ? [process.env.BROWSER_CHANNEL] : ["msedge", "chrome"];
  let last;
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: !process.env.HEADED });
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

async function main() {
  const keys = loadDemoKeys();
  await ensureFunds(keys);
  const browser = await launch();

  // ---- Preparation (not recorded) ----
  const prep = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storageState(keys, NAMES.seller) });
  const pp = await prep.newPage();
  const rentalUrl = await createOfferPrep(pp, { listing: "dr-201", amount: "800", template: "rental", platform: env.NEXT_PUBLIC_PLATFORM_RENT ?? "" });
  log(`prep rental offer: ${rentalUrl}`);
  await pp.waitForTimeout(1500);
  const graceSecs = 10;
  const deal2Url = await createOfferPrep(
    pp,
    { listing: "da-1042", amount: "1000", template: "deposit", platform: env.NEXT_PUBLIC_PLATFORM_AUTO ?? "" },
    { complete: NOSHOW_SECS - graceSecs, grace: graceSecs },
  );
  await pp.waitForTimeout(1500);
  await actAs(pp, "buyer");
  await pp.goto(deal2Url);
  await role(pp, "visitor");
  await pp.waitForFunction(() => !document.querySelector('[data-testid="reserve-btn"]')?.hasAttribute("disabled"), null, { timeout: 30_000 });
  await txStep(pp, "prep: deal 2 reserve", () => pp.getByTestId("reserve-btn").click(), statusIs(pp, "reserved"));
  const deal2Claimable = Date.now() + NOSHOW_SECS * 1000;
  await role(pp, "payer");
  await txStep(pp, "prep: deal 2 buyer confirms", () => pp.getByTestId("confirm-btn").click(), async () => (await pp.locator(".confirmed-badge").count()) > 0);
  log(`prep deal 2 (seller will vanish): ${deal2Url}`);
  await prep.close();

  // ---- Recording ----
  const ctx = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    recordVideo: { dir: VIDEO_DIR, size: SIZE },
    storageState: storageState(keys, NAMES.seller),
  });
  await ctx.addInitScript(OVERLAY_INIT);
  const page = await ctx.newPage();
  const vStart = Date.now();
  const at = () => ((Date.now() - vStart) / 1000).toFixed(1);
  const d = makeDirector(page);
  let failed = null;

  try {
    // 1 · Title + problem
    await page.setContent(TITLE_HTML);
    await d.hold(7500);
    await d.snap("01-title");
    await d.hold(3000);

    // 2 · DemoAuto listing → widget → seller creates the offer
    await page.goto(`${BASE}/demo/auto/da-2210`);
    await d.caption("1 · Seller", "DemoAuto is a fictional car marketplace. It adds Kapora with one script tag.", 2500);
    const widgetBtn = page.locator("[data-kapora-widget] button");
    await d.moveTo(widgetBtn);
    await d.caption("1 · Seller", "The seller opens the Kapora widget on the listing…", 900);
    await d.click(widgetBtn);
    const frame = page.frameLocator("iframe.kp-frame");
    await frame.locator("text=Create an offer").first().waitFor({ timeout: 60_000 });
    await d.caption("1 · Seller", "…and sets the terms: 1,000 PLN deposit, zadatek rule, demo deadlines.", 3200);
    await d.snap("02-widget-form");
    const submit = frame.getByTestId("create-offer-submit");
    await frame.locator('[data-testid="wallet-switcher"][data-connected="true"]').waitFor({ timeout: 30_000 });
    await d.caption("1 · Seller", "The seller locks their own 1,000 USDC stake first. A scammer would have to risk real money.");
    await d.moveTo(submit);
    await page.waitForFunction(
      () => !document.querySelector("iframe.kp-frame")?.contentDocument?.querySelector('[data-testid="create-offer-submit"]')?.hasAttribute("disabled"),
      null,
      { timeout: 30_000 },
    );
    await page.evaluate(() => window.__kpClick?.());
    await submit.click();
    const dealFrame = () => page.frames().find((f) => DEAL_URL_RE.test(f.url()));
    const t = Date.now();
    while (!dealFrame() && Date.now() - t < 90_000) await page.waitForTimeout(300);
    if (!dealFrame()) throw new Error("offer creation did not navigate to the deal page");
    const deal1Url = dealFrame().url().split("?")[0];
    log(`deal 1: ${deal1Url} (t=${at()}s)`);
    await frame.getByText("Share this link with the buyer").waitFor({ timeout: 60_000 });
    await frame.getByText("Share this link with the buyer").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await d.caption("1 · Seller", "Offer created on Solana. The seller sends this link to the buyer, e.g. on WhatsApp.", 3600);
    await d.snap("03-share-link");
    await d.click(page.locator(".kp-close"));

    // 3 · Buyer reserves → payment secured → both confirm → Explorer
    await page.goto(deal1Url);
    await d.caption("2 · Buyer", "The buyer opens the link and switches to their account.", 600);
    await actAs(page, "buyer", d);
    await role(page, "visitor");
    const reserve = page.getByTestId("reserve-btn");
    await d.moveTo(reserve);
    await d.caption("2 · Buyer", "Reserve: the 1,000 USDC deposit goes into a program vault, not to the seller.", 600);
    await page.waitForFunction(() => !document.querySelector('[data-testid="reserve-btn"]')?.hasAttribute("disabled"), null, { timeout: 20_000 });
    await txStep(page, "Reserve", () => d.click(reserve), statusIs(page, "reserved"));
    await role(page, "payer");
    await d.scrollTop();
    await d.caption("2 · Buyer", "Locked. 2,000 USDC now sits in the vault: the buyer's deposit plus the seller's stake.", 3400);
    await d.snap("04-reserved");
    await actAs(page, "seller", d);
    await role(page, "payee");
    await d.scrollTop();
    await d.caption("2 · Seller", "The seller sees “Payment secured”. Nobody, not even Kapora, can move that money.", 3600);
    await d.snap("05-payment-secured");
    await d.caption("3 · Handover", "At the handover both confirm “Deal completed”: two signatures release the money.", 500);
    const confirmBtn = page.getByTestId("confirm-btn");
    await txStep(page, "Seller confirms", () => d.click(confirmBtn), async () => (await page.locator(".confirmed-badge").count()) > 0);
    await page.waitForTimeout(700);
    await actAs(page, "buyer", d);
    await role(page, "payer");
    await txStep(page, "Buyer confirms", () => d.click(page.getByTestId("confirm-btn")), statusIs(page, "settled"));
    await d.scrollTop();
    await d.caption("3 · Settled", "Settled by the program: the deposit goes to the seller as part of the price.", 3600);
    await d.snap("06-completed");
    const txLink = page.getByTestId("explorer-tx-link").first();
    await txLink.waitFor({ timeout: 30_000 });
    await d.caption("3 · Proof", "Every step is a confirmed Solana transaction. Let's check one on Solana Explorer.");
    await d.moveTo(txLink);
    await page.evaluate(() => window.__kpClick?.());
    const href = await txLink.getAttribute("href");
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await page.getByText(/Success|Finalized|Confirmed/).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
    await page.getByText(/^opt-out$/i).first().click({ timeout: 1500 }).catch(() => undefined); // cookie banner
    await d.caption("3 · Proof", "Confirmed on Solana devnet: the program moved the money, not a person.", 4500);
    await d.snap("07-explorer");

    // 4 · The moment the intermediary disappears
    await page.goto(deal2Url);
    await d.caption("4 · Seller vanishes", "Deal 2: the buyer reserved and confirmed. Then the seller vanished.", 600);
    await actAs(page, "visitor", d);
    await role(page, "visitor");
    const card = page.getByTestId("claim-btn-card");
    await d.scrollTo(card);
    await d.caption("4 · Seller vanishes", "Here is a stranger's account, not part of the deal. It just waits for the deadline…", 2500);
    await d.snap("08-countdown");
    const waitLeft = deal2Claimable - Date.now();
    log(`deal 2 claimable in ${(waitLeft / 1000).toFixed(0)}s (t=${at()}s)`);
    if (waitLeft > 0) await d.caption("4 · Seller vanishes", "…the deadline passes. No court, no support ticket, no admin needed.");
    await page.locator('[data-testid="claim-btn-card"][data-ready="true"]').waitFor({ timeout: Math.max(0, waitLeft) + 90_000 });
    await page.waitForTimeout(2500); // chain clock may lag the local clock slightly
    await d.scrollTo(card);
    await d.caption("4 · Anyone", "Deadline passed. Anyone can apply the outcome the rules prescribe.", 2200);
    await d.snap("09-ready");
    await txStep(page, "Visitor applies the outcome", () => d.click(page.getByTestId("claim-btn")), statusIs(page, "settled"));
    await d.scrollTop();
    await d.caption("4 · Anyone", "The seller counts as a no-show: the buyer gets 2× back. This is where the intermediary disappears.", 5500);
    await d.snap("10-payee-noshow");

    // 5 · DemoRent: same component, another sector
    await page.goto(`${BASE}/demo/rent/dr-201`);
    await page.locator("[data-kapora-widget] button").waitFor({ timeout: 30_000 });
    await d.caption("5 · DemoRent", "Same widget, same program, another sector: renting a camera from a stranger.", 3200);
    await d.snap("11-demorent");
    await page.goto(rentalUrl);
    await actAs(page, "buyer", d);
    await role(page, "visitor");
    await d.caption("5 · DemoRent", "The renter locks an 800 USDC security deposit.", 400);
    await page.waitForFunction(() => !document.querySelector('[data-testid="reserve-btn"]')?.hasAttribute("disabled"), null, { timeout: 20_000 });
    await txStep(page, "Renter locks deposit", () => d.click(page.getByTestId("reserve-btn")), statusIs(page, "reserved"));
    await role(page, "payer");
    await d.caption("5 · DemoRent", "After the return: “I returned the item” and “Item returned in good condition”.", 400);
    await txStep(page, "Renter confirms return", () => d.click(page.getByTestId("confirm-btn")), async () => (await page.locator(".confirmed-badge").count()) > 0);
    await actAs(page, "seller", d);
    await role(page, "payee");
    await txStep(page, "Owner confirms return", () => d.click(page.getByTestId("confirm-btn")), statusIs(page, "settled"));
    await d.scrollTop();
    await d.caption("5 · DemoRent", "The deposit goes back to the renter automatically.", 4000);
    await d.snap("12-rental-done");

    // 6 · Privacy
    await page.goto(`${BASE}/stats`);
    await page.getByText("What is on-chain vs off-chain").waitFor({ timeout: 30_000 });
    await d.caption("6 · Privacy", "Anonymous stats per platform. No personal data on-chain:", 2200);
    await d.scrollTo(page.getByText("What is on-chain vs off-chain"));
    await page.evaluate(() => window.scrollBy({ top: 140, behavior: "smooth" }));
    await d.caption("6 · Privacy", "only amounts, rules, salted hashes and behaviour counters. Money on-chain, people off-chain.", 4800);
    await d.snap("13-privacy");

    // 7 · Closing
    await d.caption("", "");
    await page.setContent(CLOSING_HTML);
    await d.hold(7000);
    await d.snap("14-closing");
  } catch (e) {
    failed = e;
    console.error(`[video] FAILED: ${e.message}`);
  }

  const durationSecs = (Date.now() - vStart) / 1000;
  const video = page.video();
  await ctx.close();
  await browser.close();
  const src = await video.path();
  mkdirSync(path.dirname(OUT), { recursive: true });
  copyFileSync(src, failed ? OUT.replace(/\.webm$/, ".failed.webm") : OUT);
  const size = statSync(src).size;
  console.log(`\n[video] ${failed ? "PARTIAL (failed)" : "done"}: ${failed ? OUT.replace(/\.webm$/, ".failed.webm") : OUT}`);
  console.log(`[video] duration ≈ ${Math.floor(durationSecs / 60)}:${String(Math.round(durationSecs % 60)).padStart(2, "0")} (${durationSecs.toFixed(1)}s), size ${(size / 1024 / 1024).toFixed(1)} MB, ${SIZE.width}x${SIZE.height}`);
  if (durationSecs > 175) console.log("[video] WARNING: longer than 2:55");
  console.log("[video] captions:\n" + captions.map((c) => "  " + c).join("\n"));
  if (failed) process.exitCode = 1;
}

main();
