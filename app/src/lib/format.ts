import type BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { CLUSTER, PLN_PER_USDC } from "./config";

const DECIMALS = 6;

/** Converts base units (6 decimals) to a JS number (safe for demo-sized amounts). */
export function toUi(amount: BN | number | bigint | string): number {
  if (typeof amount === "number") return amount;
  return Number(amount.toString()) / 10 ** DECIMALS;
}

export function fmtNumber(n: number, maxFrac = 2): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

export function fmtUsdc(amount: BN | number, opts: { suffix?: boolean } = {}): string {
  const s = fmtNumber(toUi(amount));
  return opts.suffix === false ? s : `${s} USDC`;
}

export function fmtPln(amount: BN | number): string {
  return `${fmtNumber(toUi(amount) * PLN_PER_USDC, 0)} PLN`;
}

export function shortAddr(addr: PublicKey | string | null | undefined, n = 4): string {
  if (!addr) return "—";
  const s = typeof addr === "string" ? addr : addr.toBase58();
  return s.length <= n * 2 + 1 ? s : `${s.slice(0, n)}…${s.slice(-n)}`;
}

export function explorerAddress(addr: PublicKey | string): string {
  const s = typeof addr === "string" ? addr : addr.toBase58();
  return `https://explorer.solana.com/address/${s}?cluster=${CLUSTER}`;
}

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
}

/** Human duration, e.g. 90 -> "1m 30s", 7*86400 -> "7d". */
export function fmtDuration(secs: number): string {
  secs = Math.max(0, Math.floor(secs));
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && d === 0) parts.push(`${m}m`);
  if (s && d === 0 && h === 0) parts.push(`${s}s`);
  return parts.length ? parts.join(" ") : "0s";
}

/** Countdown clock, e.g. "04:59", "1d 02:03:04". */
export function fmtCountdown(secs: number): string {
  secs = Math.max(0, Math.floor(secs));
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  const core = h || d ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return d ? `${d}d ${core}` : core;
}

export function fmtDateTime(unix: number): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function bytesToHex(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isZeroBytes(bytes: ArrayLike<number> | null | undefined): boolean {
  if (!bytes) return true;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) return false;
  return true;
}

export function parsePubkey(s: string | null | undefined): PublicKey | null {
  if (!s) return null;
  try {
    return new PublicKey(s.trim());
  } catch {
    return null;
  }
}
