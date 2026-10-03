/**
 * End-to-end flows on devnet through the SDK (deposit / zadatek template):
 *   default      payee creates offer -> payer reserves -> both confirm -> Completed
 *   --withdraw   payee backs out -> payer gets 2x
 *   --disappear  payer reserves + confirms, payee vanishes; after the deadline a third
 *                party (the arbiter key, standing in for "anyone") applies the outcome
 *                -> PayeeNoShow, payer gets 2x. No intermediary involved.
 *
 * Usage: pnpm devnet:happy [-- --withdraw | --disappear]   (after `pnpm devnet:setup`)
 */
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { createHash, randomBytes } from "node:crypto";

import { TEMPLATES, fromBaseUnits, toBaseUnits } from "../sdk/src";
import { clientFor, connection, explorer, namedKeypair, pk, readDeployment } from "./common";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dep = readDeployment();
  const conn = connection();
  const payee = clientFor(namedKeypair("demo-payee"), conn);
  const payer = clientFor(namedKeypair("demo-payer"), conn);
  const anyone = clientFor(namedKeypair("demo-arbiter"), conn);
  const mint = pk(dep.usdcMint);
  const flow = process.argv.includes("--withdraw")
    ? "withdraw"
    : process.argv.includes("--disappear")
      ? "disappear"
      : "complete";

  const usdc = async (owner: PublicKey) => {
    const b = await conn.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, owner));
    return b.value.uiAmount;
  };
  const balances = async () =>
    `payee ${await usdc(payee.walletKey)} USDC | payer ${await usdc(payer.walletKey)} USDC`;
  console.log(`flow: ${flow}\n${await balances()}`);

  const salt = randomBytes(16);
  const listingHash = createHash("sha256")
    .update(Buffer.concat([salt, Buffer.from(JSON.stringify({ id: "script-demo", title: "Demo car" }))]))
    .digest();

  const t = TEMPLATES.deposit;
  const amount = toBaseUnits(2_000);
  const windows =
    flow === "disappear"
      ? { completeWindowSecs: 15, graceSecs: 5 }
      : { completeWindowSecs: 60, graceSecs: 30 };
  const { deal, signature } = await payee.createOffer({
    mint,
    payerAmount: amount,
    payeeStake: amount,
    penalty: t.penalty,
    onComplete: t.onComplete,
    legalLabel: t.legalLabel,
    template: t.id,
    listingHash: Array.from(listingHash),
    reserveWindowSecs: 600,
    arbiterWindowSecs: 60,
    ...windows,
    arbiter: null,
    platform: pk(dep.platforms.demoAuto),
  });
  console.log("create_offer", deal.toBase58(), explorer(signature));
  console.log("reserve     ", explorer(await payer.reserve(deal)));

  if (flow === "withdraw") {
    console.log("payee withdraws", explorer(await payee.withdraw(deal)));
  } else if (flow === "disappear") {
    console.log("payer confirms ", explorer(await payer.confirm(deal)));
    console.log("payee disappears... waiting for the deadline");
    let d = (await payer.getDeal(deal))!;
    while (Math.floor(Date.now() / 1000) <= d.claimableAt + 2) await sleep(2_000);
    for (let i = 0; ; i++) {
      try {
        console.log("anyone applies the outcome", explorer(await anyone.claimAfterDeadline(deal)));
        break;
      } catch (e) {
        if (i > 10 || !String(e).includes("DeadlineNotReached")) throw e;
        await sleep(2_000); // cluster clock can lag wall clock a little
      }
    }
    d = (await payer.getDeal(deal))!;
  } else {
    console.log("payer confirms", explorer(await payer.confirm(deal)));
    console.log("payee confirms", explorer(await payee.confirm(deal)));
  }

  const d = (await payee.getDeal(deal))!;
  console.log("status", d.status, "outcome", d.outcome);
  console.log(await balances());
  for (const [label, c] of [["payee", payee], ["payer", payer]] as const) {
    const p = (await payee.getProfile(c.walletKey))!;
    console.log(`${label} profile`, {
      completed: p.completed,
      withdrew: p.withdrew,
      noShow: p.noShow,
      volume: fromBaseUnits(p.volumeCompleted ?? new BN(0)),
    });
  }
  const stats = (await payee.getPlatformStats(pk(dep.platforms.demoAuto)))!;
  console.log("DemoAuto stats", { offers: stats.offers.toString(), completed: stats.completed.toString() });
  console.log(`deal page: http://localhost:3000/d/${deal.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
