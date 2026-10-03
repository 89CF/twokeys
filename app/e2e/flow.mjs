// End-to-end demo flow for Kapora, driven purely through the UI with the devnet demo accounts.
//
//   pnpm --filter @kapora/app e2e                       (app must already be running at BASE_URL)
//
// Env:
//   BASE_URL        default http://localhost:3000
//   HEADED=1        show the browser
//   BROWSER_CHANNEL force "msedge" or "chrome" (default: try msedge, then chrome; uses the installed browser)
//   DEPOSIT         amount in USDC the payer locks in every run (default 500; one faucet round covers all runs)
//   COMPLETE_SECS   "both confirm within" window for run 2 (default 20)
//   GRACE_SECS      objection period for run 2 (default 10)
//   SKIP_FUND=1     don't press "Fund demo accounts"
//   ONLY=complete|noshow|rental   run a single scenario
//   FRESH=1         start with new demo accounts (ignore e2e/.state.json)
//
// Run 1 (DemoAuto, deposit/zadatek): seller creates offer -> buyer reserves -> both confirm -> "completed".
// Run 2 (DemoAuto, the moment the intermediary disappears): buyer reserves and confirms, the seller vanishes;
//        after the deadline a third party ("Demo Visitor") applies the outcome -> "payeeNoShow", buyer gets 2x.
// Run 3 (DemoRent, rental): owner creates offer -> renter locks the security deposit -> both confirm the return
//        -> "completed", deposit back to the renter.
// Screenshots for the pitch deck are written to app/e2e/screens/.

import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const HEADED = !!process.env.HEADED;
const DEPOSIT = Number(process.env.DEPOSIT || 500);
const COMPLETE_SECS = Number(process.env.COMPLETE_SECS || 20);
const GRACE_SECS = Number(process.env.GRACE_SECS || 10);
const ONLY = process.env.ONLY || "";
const SCREENS = path.join(path.dirname(fileURLToPath(import.meta.url)), "screens");
// Demo account keys live in the browser's localStorage; persisting it lets repeat runs reuse the funded accounts.
const STATE = path.join(path.dirname(fileURLToPath(import.meta.url)), ".state.json");
const TX_TIMEOUT = 120_000;
const ERROR_TOAST = '[data-sonner-toast][data-type="error"]';
const DEAL_URL_RE = /\/d\/(?!new\b)([1-9A-HJ-NP-Za-km-z]{32,44})(?:[?#]|$)/;
const NAMES = { seller: "Demo Seller", buyer: "Demo Buyer", visitor: "Demo Visitor" };

mkdirSync(SCREENS, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`[e2e +${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

async function launch() {
  const channels = process.env.BROWSER_CHANNEL ? [process.env.BROWSER_CHANNEL] : ["msedge", "chrome"];
  let lastErr;
  for (const channel of channels) {
    try {
      const browser = await chromium.launch({ channel, headless: !HEADED });
      log(`browser: ${channel}`);
      return browser;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not launch Edge or Chrome: ${lastErr?.message}`);
}

async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(700); // let animations settle
  // Deck screenshots: hide transient toasts.
  const style = await page.addStyleTag({ content: "[data-sonner-toaster]{display:none!important}" });
  await page.screenshot({ path: path.join(SCREENS, `${name}.png`), fullPage });
  await style.evaluate((el) => el.remove()).catch(() => undefined);
  log(`screenshot -> e2e/screens/${name}.png`);
}

/** Switch the connected account via the header "Acting as" menu. */
async function actAs(page, who) {
  const name = NAMES[who];
  const sw = page.getByTestId("wallet-switcher");
  await sw.waitFor({ state: "visible", timeout: 30_000 });
  if ((await sw.getAttribute("data-wallet")) === name && (await sw.getAttribute("data-connected")) === "true") return;
  await sw.click();
  await page.getByTestId(`switch-demo-${who}`).click();
  await page.locator(`[data-testid="wallet-switcher"][data-wallet="${name}"][data-connected="true"]`).waitFor({ timeout: 20_000 });
  log(`acting as ${name} (${await sw.getAttribute("data-address")})`);
}

/** Clicks, then waits until `done()` is truthy or a new error toast appears (throws with the toast text). */
async function txStep(page, label, click, done, timeout = TX_TIMEOUT) {
  const before = await page.locator(ERROR_TOAST).count();
  log(`${label}…`);
  await click();
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await done()) {
      log(`${label}: ok`);
      return;
    }
    const n = await page.locator(ERROR_TOAST).count();
    if (n > before) {
      const text = (await page.locator(ERROR_TOAST).last().innerText()).replace(/\s+/g, " ").trim();
      throw new Error(`${label} failed: ${text}`);
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`${label}: timed out after ${timeout / 1000}s`);
}

const statusIs = (page, status) => async () => (await page.locator(`[data-testid="deal-status"][data-status="${status}"]`).count()) > 0;
const rolePill = (page, role) => page.locator(`[data-testid="role-pill"][data-role="${role}"]`).waitFor({ timeout: 30_000 });

async function fundDemoAccounts(page) {
  await page.goto(`${BASE}/dev/faucet`);
  await actAs(page, "seller");
  const btn = page.getByTestId("fund-demo-wallets");
  await btn.waitFor({ timeout: 20_000 });
  if (await btn.isDisabled()) {
    log("WARN: 'Fund demo accounts' is disabled (NEXT_PUBLIC_USDC_MINT not configured?) - continuing without funding");
    return;
  }
  await btn.click();
  const status = page.locator('[data-testid="fund-demo-status"]:is([data-state="done"],[data-state="error"])');
  await status.waitFor({ state: "attached", timeout: 240_000 });
  log(`funding ${await status.getAttribute("data-state")}:\n${await status.innerText()}`);
  await page.waitForTimeout(2500);
  await shot(page, "00-faucet-demo-accounts");
}

/** Opens the widget on a listing page, screenshots the modal and returns the /d/new URL it points to. */
async function openWidget(page, listingPath, prefix) {
  await page.goto(`${BASE}${listingPath}`);
  const widgetBtn = page.locator("[data-kapora-widget] button");
  await widgetBtn.waitFor({ timeout: 30_000 });
  await shot(page, `${prefix}-listing-widget`);
  await widgetBtn.click();
  const frame = page.locator("iframe.kp-frame");
  await frame.waitFor({ timeout: 15_000 });
  await page.frameLocator("iframe.kp-frame").locator("text=Create an offer").first().waitFor({ timeout: 60_000 });
  await page.screenshot({ path: path.join(SCREENS, `${prefix}-widget-modal.png`) });
  log(`screenshot -> e2e/screens/${prefix}-widget-modal.png`);
  const src = await frame.getAttribute("src");
  await page.locator(".kp-close").click();
  const url = new URL(src, BASE);
  url.searchParams.delete("embed");
  return url.toString();
}

/** Creates an offer on /d/new as Demo Seller and returns the deal URL. */
async function createOffer(page, newDealUrl, prefix, windows = {}) {
  await page.goto(newDealUrl);
  await actAs(page, "seller");
  await page.getByTestId("deposit-input").fill(String(DEPOSIT));
  const zadatek = page.getByTestId("rule-zadatek");
  if (await zadatek.count()) await zadatek.click();
  for (const [k, v] of Object.entries(windows)) await page.getByTestId(`window-${k}`).fill(String(v));
  await shot(page, `${prefix}-create-offer`);
  const submit = page.getByTestId("create-offer-submit");
  await submit.waitFor({ timeout: 20_000 });
  if (await submit.isDisabled()) throw new Error("Create offer button is disabled (form validation or account not connected)");
  await txStep(page, "Create offer", () => submit.click(), async () => DEAL_URL_RE.test(page.url()));
  const dealUrl = page.url().split("?")[0];
  log(`deal: ${dealUrl}`);
  await page.locator('[data-testid="deal-status"][data-status="offered"]').waitFor({ timeout: 60_000 });
  await shot(page, `${prefix}-offer-share-link`);
  return dealUrl;
}

async function reserveAsBuyer(page, dealUrl) {
  await actAs(page, "buyer");
  await page.goto(dealUrl);
  await rolePill(page, "visitor");
  const btn = page.getByTestId("reserve-btn");
  await btn.waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="reserve-btn"]')?.hasAttribute("disabled"), null, { timeout: 20_000 });
  await txStep(page, "Reserve", () => btn.click(), statusIs(page, "reserved"));
  await rolePill(page, "payer");
}

async function confirmAs(page, who) {
  await actAs(page, who);
  await rolePill(page, who === "seller" ? "payee" : "payer");
  const btn = page.getByTestId("confirm-btn");
  await txStep(page, `Confirm (${NAMES[who]})`, () => btn.click(), async () =>
    (await page.locator(".confirmed-badge").count()) > 0 || (await statusIs(page, "settled")()),
  );
}

async function expectOutcome(page, outcome, payerBaseUnits) {
  await page.locator('[data-testid="deal-status"][data-status="settled"]').waitFor({ timeout: 60_000 });
  const got = await page.getByTestId("outcome-title").getAttribute("data-outcome");
  if (got !== outcome) throw new Error(`Expected outcome "${outcome}", got "${got}"`);
  if (payerBaseUnits !== undefined) {
    const toPayer = await page.getByTestId("outcome-payer-amount").getAttribute("data-base-units");
    if (toPayer !== String(payerBaseUnits)) throw new Error(`Expected payer to receive ${payerBaseUnits} base units, got ${toPayer}`);
  }
  // Mandatory for judges: confirmed transactions are linked to Solana Explorer on the page.
  await page.getByTestId("explorer-tx-link").first().waitFor({ timeout: 60_000 });
  // let the activity log and payout link catch up with the chain before screenshots
  await page.waitForFunction(() => !document.querySelector('[data-testid="activity-list"]')?.textContent?.includes("confirming"), null, { timeout: 30_000 }).catch(() => undefined);
  await page.getByText("View payout on Solana Explorer").waitFor({ timeout: 30_000 }).catch(() => undefined);
  log(`assert: outcome == "${outcome}"${payerBaseUnits !== undefined ? `, payer received ${Number(payerBaseUnits) / 1e6} USDC` : ""}, explorer links shown ✔`);
}

async function runComplete(page) {
  log("=== Run 1: DemoAuto deposit, both confirm ===");
  const newUrl = await openWidget(page, "/demo/auto/da-2210", "01");
  const dealUrl = await createOffer(page, newUrl, "02");
  await reserveAsBuyer(page, dealUrl);
  await shot(page, "03-deal-reserved-buyer");
  await actAs(page, "seller");
  await rolePill(page, "payee");
  await page.getByText("Payment secured").waitFor({ timeout: 20_000 });
  await shot(page, "04-deal-reserved-seller-payment-secured");
  await confirmAs(page, "buyer");
  await confirmAs(page, "seller");
  await expectOutcome(page, "completed");
  await shot(page, "05-deal-completed");
  return dealUrl;
}

async function runPayeeDisappears(page) {
  log("=== Run 2: DemoAuto, the seller disappears; anyone applies the outcome ===");
  const q = new URLSearchParams({ listing: "da-1042", amount: String(DEPOSIT), template: "deposit" });
  const platform = await (async () => {
    await page.goto(`${BASE}/demo/auto/da-1042`);
    await page.locator("[data-kapora-widget] button").waitFor({ timeout: 30_000 });
    return page.locator('script[src^="/widget.js"]').first().getAttribute("data-platform");
  })();
  if (platform) q.set("platform", platform);
  const dealUrl = await createOffer(page, `${BASE}/d/new?${q}`, "06", { complete: COMPLETE_SECS, grace: GRACE_SECS });
  await reserveAsBuyer(page, dealUrl);
  await confirmAs(page, "buyer");
  log(`seller does nothing… waiting ~${COMPLETE_SECS + GRACE_SECS}s for the deadline`);

  await actAs(page, "visitor");
  await rolePill(page, "visitor");
  await page.locator('[data-testid="claim-btn-card"][data-ready="false"]').waitFor({ timeout: 30_000 }).catch(() => undefined);
  if ((await page.locator('[data-testid="claim-btn-card"][data-ready="false"]').count()) > 0) await shot(page, "07-waiting-for-deadline");
  await page.locator('[data-testid="claim-btn-card"][data-ready="true"]').waitFor({ timeout: (COMPLETE_SECS + GRACE_SECS) * 1000 + 120_000 });
  await page.waitForTimeout(3000); // chain clock may lag the local clock slightly
  await shot(page, "08-deadline-passed-anyone-can-apply");
  await txStep(page, "Apply the outcome (Demo Visitor)", () => page.getByTestId("claim-btn").click(), statusIs(page, "settled"));
  await expectOutcome(page, "payeeNoShow", 2 * DEPOSIT * 1_000_000);
  await shot(page, "09-seller-disappeared-buyer-2x");
  return dealUrl;
}

async function runRental(page) {
  log("=== Run 3: DemoRent rental, item returned ===");
  const newUrl = await openWidget(page, "/demo/rent/dr-201", "10");
  const dealUrl = await createOffer(page, newUrl, "11");
  await reserveAsBuyer(page, dealUrl);
  await confirmAs(page, "buyer"); // "I returned the item"
  await confirmAs(page, "seller"); // "Item returned in good condition"
  await expectOutcome(page, "completed", DEPOSIT * 1_000_000);
  await shot(page, "12-rental-deposit-returned");
  return dealUrl;
}

async function main() {
  log(`BASE_URL=${BASE}  amount=${DEPOSIT} USDC  run-2 windows: complete ${COMPLETE_SECS}s + grace ${GRACE_SECS}s`);
  const browser = await launch();
  const reuse = !process.env.FRESH && existsSync(STATE);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: reuse ? STATE : undefined });
  log(reuse ? "reusing demo accounts from e2e/.state.json" : "new demo accounts");
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  const results = {};
  try {
    if (!process.env.SKIP_FUND) await fundDemoAccounts(page);
    if (!ONLY || ONLY === "complete") results.completed = await runComplete(page);
    if (!ONLY || ONLY === "noshow") results.payeeNoShow = await runPayeeDisappears(page);
    if (!ONLY || ONLY === "rental") results.rental = await runRental(page);
    log("ALL GREEN", results);
  } catch (e) {
    console.error(`\n[e2e] FAILED: ${e.message}\n`);
    await page.screenshot({ path: path.join(SCREENS, "zz-failure.png"), fullPage: true }).catch(() => undefined);
    console.error("[e2e] failure screenshot -> e2e/screens/zz-failure.png");
    process.exitCode = 1;
  } finally {
    if (pageErrors.length) console.warn("[e2e] page errors:\n - " + pageErrors.join("\n - "));
    await context.storageState({ path: STATE }).catch(() => undefined);
    await browser.close();
  }
}

main();
