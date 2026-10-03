import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { KaporaClient } from "../sdk/src";

export const ROOT = path.join(__dirname, "..");
export const KEYS_DIR = path.join(ROOT, "keys");
export const DEPLOYMENT_FILE = path.join(ROOT, "deployments", "devnet.json");
export const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";

export interface Deployment {
  cluster: string;
  programId: string;
  usdcMint: string;
  mintAuthority: string;
  arbiter: string;
  platforms: { demoAuto: string; demoRent: string };
  demoWallets: { payee: string; payer: string };
}

export function connection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export function loadKeypair(file: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

/** Loads keys/<name>.json, creating it on first use. */
export function namedKeypair(name: string): Keypair {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  const file = path.join(KEYS_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    const kp = Keypair.generate();
    fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
  }
  return loadKeypair(file);
}

/** The Solana CLI wallet (pays for setup). */
export function cliWalletKeypair(): Keypair {
  const file =
    process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config", "solana", "id.json");
  return loadKeypair(file);
}

export function clientFor(kp: Keypair, conn = connection()): KaporaClient {
  const provider = new AnchorProvider(conn, new Wallet(kp), { commitment: "confirmed" });
  return new KaporaClient(provider);
}

export function readDeployment(): Deployment {
  return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8")) as Deployment;
}

export function writeDeployment(d: Deployment): void {
  fs.mkdirSync(path.dirname(DEPLOYMENT_FILE), { recursive: true });
  fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(d, null, 2) + "\n");
}

export const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const pk = (s: string) => new PublicKey(s);
