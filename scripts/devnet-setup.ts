/**
 * Devnet bootstrap (idempotent):
 *  - creates the test USDC mint (6 decimals) with keys/usdc-mint-authority.json as authority
 *  - creates demo wallets (payee, payer, arbiter) + platform ids for DemoAuto / DemoRent
 *  - funds demo wallets with SOL (from the CLI wallet) and test USDC
 *  - writes deployments/devnet.json and app/.env.local
 *
 * Usage: pnpm devnet:setup
 */
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

import { KAPORA_PROGRAM_ID } from "../sdk/src";
import {
  ROOT,
  connection,
  namedKeypair,
  cliWalletKeypair,
  writeDeployment,
} from "./common";

const SOL_PER_WALLET = Number(process.env.SOL_PER_WALLET ?? 0.2);
const USDC_PER_WALLET = Number(process.env.USDC_PER_WALLET ?? 10_000);

async function main() {
  const conn = connection();
  const funder = cliWalletKeypair();
  console.log("funder", funder.publicKey.toBase58(), (await conn.getBalance(funder.publicKey)) / LAMPORTS_PER_SOL, "SOL");

  const mintAuthority = namedKeypair("usdc-mint-authority");
  const mintKp = namedKeypair("usdc-mint");
  const payee = namedKeypair("demo-payee");
  const payer = namedKeypair("demo-payer");
  const arbiter = namedKeypair("demo-arbiter");
  const demoAuto = namedKeypair("platform-demoauto").publicKey;
  const demoRent = namedKeypair("platform-demorent").publicKey;

  // SOL for the mint authority (pays ATA rent in the faucet) and demo wallets
  const targets: [string, Keypair, number][] = [
    ["mint authority", mintAuthority, 0.5],
    ["payee", payee, SOL_PER_WALLET],
    ["payer", payer, SOL_PER_WALLET],
    ["arbiter", arbiter, SOL_PER_WALLET / 2],
  ];
  for (const [label, kp, sol] of targets) {
    const bal = await conn.getBalance(kp.publicKey);
    const want = Math.floor(sol * LAMPORTS_PER_SOL);
    if (bal >= want / 2) {
      console.log(`${label} has ${bal / LAMPORTS_PER_SOL} SOL`);
      continue;
    }
    await sendAndConfirmTransaction(
      conn,
      new Transaction().add(
        SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: kp.publicKey, lamports: want - bal }),
      ),
      [funder],
    );
    console.log(`funded ${label} with ${(want - bal) / LAMPORTS_PER_SOL} SOL`);
  }

  // test USDC mint
  let mint = mintKp.publicKey;
  if (!(await conn.getAccountInfo(mint))) {
    mint = await createMint(conn, funder, mintAuthority.publicKey, null, 6, mintKp);
    console.log("created test USDC mint", mint.toBase58());
  } else {
    console.log("test USDC mint exists", mint.toBase58());
  }

  for (const [label, kp] of [["payee", payee], ["payer", payer]] as const) {
    const ata = await getOrCreateAssociatedTokenAccount(conn, funder, mint, kp.publicKey);
    const want = BigInt(USDC_PER_WALLET) * 1_000_000n;
    if (ata.amount < want) {
      await mintTo(conn, funder, mint, ata.address, mintAuthority, want - ata.amount);
      console.log(`minted ${Number(want - ata.amount) / 1e6} USDC to ${label}`);
    }
  }

  writeDeployment({

    cluster: "devnet",
    programId: KAPORA_PROGRAM_ID.toBase58(),
    usdcMint: mint.toBase58(),
    mintAuthority: mintAuthority.publicKey.toBase58(),
    arbiter: arbiter.publicKey.toBase58(),
    platforms: { demoAuto: demoAuto.toBase58(), demoRent: demoRent.toBase58() },
    demoWallets: { payee: payee.publicKey.toBase58(), payer: payer.publicKey.toBase58() },
  });

  const env = [
    `NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com`,
    `NEXT_PUBLIC_PROGRAM_ID=${KAPORA_PROGRAM_ID.toBase58()}`,
    `NEXT_PUBLIC_USDC_MINT=${mint.toBase58()}`,
    `NEXT_PUBLIC_ARBITER=${arbiter.publicKey.toBase58()}`,
    `NEXT_PUBLIC_PLATFORM_AUTO=${demoAuto.toBase58()}`,
    `NEXT_PUBLIC_PLATFORM_RENT=${demoRent.toBase58()}`,
    `FAUCET_SECRET_KEY=${JSON.stringify(Array.from(mintAuthority.secretKey))}`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, "app", ".env.local"), env);
  console.log("wrote deployments/devnet.json and app/.env.local");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
