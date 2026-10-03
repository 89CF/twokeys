import { NextResponse } from "next/server";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { FAUCET_AMOUNT, RPC_URL, USDC_MINT, USDC_MINT_CONFIGURED } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Top up fees from the faucet keypair when the wallet is below this balance (devnet airdrops are rate-limited). */
const SOL_MIN = 0.01 * LAMPORTS_PER_SOL;
const SOL_TOPUP = 0.03 * LAMPORTS_PER_SOL;

/** Very small in-memory rate limit: one request per wallet every 20 seconds. */
const lastHit = new Map<string, number>();

/** Public devnet RPCs rate-limit bursts (HTTP 429); retry with backoff. */
async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/429|Too Many Requests|rate limit/i.test(msg) || i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

function loadAuthority(): Keypair | null {
  const raw = (process.env.FAUCET_SECRET_KEY || "").trim();
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  } catch {
    return null;
  }
}

/**
 * POST /api/faucet  body: { wallet: string }
 * Mints 1,000 test USDC (devnet) to the wallet (creating its associated token account if needed) and, if the wallet
 * has < 0.01 SOL, transfers 0.03 SOL for fees from the faucet keypair. A devnet airdrop is attempted as a no-throw extra.
 */
export async function POST(req: Request) {
  if (!/devnet|localhost|127\.0\.0\.1/.test(RPC_URL)) {
    return NextResponse.json({ error: "The faucet only works on devnet." }, { status: 400 });
  }
  let owner: PublicKey;
  try {
    const body = (await req.json()) as { wallet?: string };
    owner = new PublicKey(String(body.wallet || ""));
  } catch {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const authority = loadAuthority();
  if (!authority || !USDC_MINT_CONFIGURED) {
    return NextResponse.json(
      { error: "Faucet is not configured. Set FAUCET_SECRET_KEY and NEXT_PUBLIC_USDC_MINT on the server." },
      { status: 503 },
    );
  }

  const key = owner.toBase58();
  const now = Date.now();
  if (now - (lastHit.get(key) ?? 0) < 20_000) {
    return NextResponse.json({ error: "Easy there: one faucet request per 20 seconds." }, { status: 429 });
  }
  lastHit.set(key, now);

  const connection = new Connection(RPC_URL, "confirmed");
  try {
    const ata = await withRetry(() => getOrCreateAssociatedTokenAccount(connection, authority, USDC_MINT, owner));
    const signature = await withRetry(() => mintTo(connection, authority, USDC_MINT, ata.address, authority, BigInt(FAUCET_AMOUNT) * 1_000_000n));

    // SOL for fees: transfer from the faucet keypair (reliable), plus a best-effort airdrop (often rate-limited).
    let solTransfer: string | null = null;
    let solError: string | null = null;
    const balance = await withRetry(() => connection.getBalance(owner, "confirmed")).catch(() => 0);
    if (balance < SOL_MIN) {
      try {
        const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: owner, lamports: SOL_TOPUP }));
        solTransfer = await withRetry(() => sendAndConfirmTransaction(connection, tx, [authority], { commitment: "confirmed" }));
      } catch (e) {
        solError = e instanceof Error ? e.message || e.name : String(e);
      }
    }
    let airdrop: string | null = null;
    let airdropError: string | null = null;
    if (!solTransfer && balance < SOL_MIN) {
      try {
        airdrop = await connection.requestAirdrop(owner, 1 * LAMPORTS_PER_SOL);
      } catch (e) {
        airdropError = e instanceof Error ? e.message : String(e);
      }
    }

    return NextResponse.json({
      signature,
      ata: ata.address.toBase58(),
      amount: FAUCET_AMOUNT,
      solTransfer,
      solLamports: solTransfer ? SOL_TOPUP : 0,
      solError,
      airdrop,
      airdropError,
    });
  } catch (e) {
    lastHit.delete(key);
    // spl-token errors (e.g. TokenAccountNotFoundError) often carry an empty message; fall back to the error name.
    const msg = e instanceof Error ? e.message || e.name : String(e);
    console.error("[api/faucet]", msg);
    return NextResponse.json({ error: `Mint failed: ${msg}` }, { status: 500 });
  }
}
