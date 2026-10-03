import { PublicKey } from "@solana/web3.js";

// NOTE: NEXT_PUBLIC_* variables must be referenced literally so Next.js can inline them at build time.

/** Placeholder pubkeys so the app builds and renders without any env configured. */
const PLACEHOLDER = {
  usdcMint: "3w1R8ipg5fGam6W1jhHXxe3ohjU9SSqrw2GvpJqhYZG1",
  platformAuto: "HkEJe8CxQERQbuhYRhcuqBvEedS29YEN1kiGuG7gsRpK",
  platformRent: "52rEbnTr1kWJuJ5kubWMpXas2oSVCNZT7dLSaJ93Dfk4",
};

function pk(value: string | undefined, fallback: string | null): PublicKey | null {
  const v = (value ?? "").trim();
  if (v) {
    try {
      return new PublicKey(v);
    } catch {
      console.warn(`[kapora] invalid public key in env: ${v}`);
    }
  }
  return fallback ? new PublicKey(fallback) : null;
}

export const RPC_URL = (process.env.NEXT_PUBLIC_RPC_URL || "").trim() || "https://api.devnet.solana.com";

/** undefined = let the SDK use its built-in KAPORA_PROGRAM_ID */
export const PROGRAM_ID: PublicKey | undefined = pk(process.env.NEXT_PUBLIC_PROGRAM_ID, null) ?? undefined;

export const USDC_MINT: PublicKey = pk(process.env.NEXT_PUBLIC_USDC_MINT, PLACEHOLDER.usdcMint)!;
export const USDC_MINT_CONFIGURED = !!(process.env.NEXT_PUBLIC_USDC_MINT || "").trim();

/** Demo arbiter suggested by default in the offer form (null = none configured). */
export const DEFAULT_ARBITER: PublicKey | null = pk(process.env.NEXT_PUBLIC_ARBITER, null);

export const PLATFORM_AUTO: PublicKey = pk(process.env.NEXT_PUBLIC_PLATFORM_AUTO, PLACEHOLDER.platformAuto)!;
/** DemoRent platform key. NEXT_PUBLIC_PLATFORM_ESTATE is still read as a fallback (old name). */
export const PLATFORM_RENT: PublicKey = pk(
  process.env.NEXT_PUBLIC_PLATFORM_RENT || process.env.NEXT_PUBLIC_PLATFORM_ESTATE,
  PLACEHOLDER.platformRent,
)!;

export const PLATFORMS = [
  { key: "auto", name: "DemoAuto", vertical: "Cars", pubkey: PLATFORM_AUTO, href: "/demo/auto" },
  { key: "rent", name: "DemoRent", vertical: "Equipment rental", pubkey: PLATFORM_RENT, href: "/demo/rent" },
] as const;

export function platformName(platform: PublicKey | string): string | null {
  const s = typeof platform === "string" ? platform : platform.toBase58();
  return PLATFORMS.find((p) => p.pubkey.toBase58() === s)?.name ?? null;
}

export const CLUSTER = "devnet";

/** Demo exchange rate shown in the UI. */
export const PLN_PER_USDC = 1;

export const DEMO_WINDOWS = { reserve: 600, complete: 60, grace: 30, arbiter: 60 };
export const REAL_WINDOWS = { reserve: 7 * 86400, complete: 30 * 86400, grace: 2 * 86400, arbiter: 7 * 86400 };

export const FAUCET_AMOUNT = 1000;
