"use client";

import { ed25519 } from "@noble/curves/ed25519";
import {
  BaseMessageSignerWalletAdapter,
  WalletNotConnectedError,
  WalletReadyState,
  isVersionedTransaction,
  type TransactionOrVersionedTransaction,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { Keypair, type PublicKey, type TransactionVersion } from "@solana/web3.js";
import { RPC_URL } from "./config";

/**
 * DEVNET-ONLY demo accounts: persistent in-browser keypairs ("Demo Seller", "Demo Buyer", "Demo Visitor") so a single
 * presenter (or an E2E script) can play both sides of a deal, and show that an uninvolved visitor can trigger the payout. Secret keys live in localStorage in plain text,
 * so never use these on mainnet or with real funds.
 */
export type DemoWalletId = "seller" | "buyer" | "visitor";

export const DEMO_WALLET_NAMES: Record<DemoWalletId, WalletName> = {
  seller: "Demo Seller" as WalletName<"Demo Seller">,
  buyer: "Demo Buyer" as WalletName<"Demo Buyer">,
  visitor: "Demo Visitor" as WalletName<"Demo Visitor">,
};

export const DEMO_WALLET_IDS: DemoWalletId[] = ["seller", "buyer", "visitor"];

export const DEMO_WALLETS_ENABLED = /devnet|localhost|127\.0\.0\.1/.test(RPC_URL);

const storageKey = (id: DemoWalletId) => `twokeys:demo-wallet:${id}`;

/** Loads the persistent demo keypair for `id`, creating (and storing) it on first use. Browser only. */
export function loadDemoKeypair(id: DemoWalletId): Keypair {
  const raw = window.localStorage.getItem(storageKey(id));
  if (raw) {
    try {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    } catch {
      /* corrupted entry: regenerate */
    }
  }
  const kp = Keypair.generate();
  window.localStorage.setItem(storageKey(id), JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

export function demoPublicKey(id: DemoWalletId): PublicKey {
  return loadDemoKeypair(id).publicKey;
}

export function isDemoWalletName(name: string | null | undefined): boolean {
  return Object.values(DEMO_WALLET_NAMES).includes(name as WalletName);
}

function icon(color1: string, color2: string, letter: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${color1}"/><stop offset="1" stop-color="${color2}"/></linearGradient></defs>` +
    `<rect width="32" height="32" rx="9" fill="url(#g)"/><text x="16" y="21.5" font-family="Arial,sans-serif" font-size="15" ` +
    `font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export class DemoWalletAdapter extends BaseMessageSignerWalletAdapter {
  readonly name: WalletName;
  readonly url = "https://solana.com/developers";
  readonly icon: string;
  readonly supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set(["legacy", 0] as TransactionVersion[]);
  private _keypair: Keypair | null = null;
  private _connecting = false;

  constructor(readonly demoId: DemoWalletId) {
    super();
    this.name = DEMO_WALLET_NAMES[demoId];
    this.icon =
      demoId === "seller" ? icon("#8b5cf6", "#6366f1", "S") : demoId === "buyer" ? icon("#0ea5e9", "#14f195", "B") : icon("#64748b", "#334155", "V");
  }

  get readyState(): WalletReadyState {
    return typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.Installed;
  }
  get publicKey(): PublicKey | null {
    return this._keypair?.publicKey ?? null;
  }
  get connecting(): boolean {
    return this._connecting;
  }

  async connect(): Promise<void> {
    if (this._keypair || this._connecting) return;
    this._connecting = true;
    try {
      this._keypair = loadDemoKeypair(this.demoId);
      this.emit("connect", this._keypair.publicKey);
    } finally {
      this._connecting = false;
    }
  }

  // Must emit synchronously: the provider swaps wallets right after calling disconnect() on the old adapter.
  async disconnect(): Promise<void> {
    if (!this._keypair) return;
    this._keypair = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends TransactionOrVersionedTransaction<this["supportedTransactionVersions"]>>(transaction: T): Promise<T> {
    const kp = this._keypair;
    if (!kp) throw new WalletNotConnectedError();
    if (isVersionedTransaction(transaction)) transaction.sign([kp]);
    else transaction.partialSign(kp);
    return transaction;
  }

  /** Ed25519 signature over raw message bytes (same format as Phantom/Solflare `signMessage`). */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const kp = this._keypair;
    if (!kp) throw new WalletNotConnectedError();
    return ed25519.sign(message, kp.secretKey.slice(0, 32));
  }
}
