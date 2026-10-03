import { NextResponse } from "next/server";
import { readDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/records?listingHash=<hex>   -> { listing: { listingId, platform, data } | null }
 * GET /api/records?deal=<pubkey>       -> { evidence: [{ hash, uploader, data, createdAt }] }
 *
 * Off-chain lookups so the UI can show human-readable listing details / evidence next to on-chain hashes.
 * Salts are never returned.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const listingHash = url.searchParams.get("listingHash");
  const deal = url.searchParams.get("deal");
  const db = await readDb();

  if (listingHash) {
    const rec = db.listings.find((l) => l.hash === listingHash.toLowerCase());
    return NextResponse.json({
      listing: rec ? { listingId: rec.listingId ?? null, platform: rec.platform ?? null, data: rec.data, createdAt: rec.createdAt } : null,
    });
  }
  if (deal) {
    const evidence = db.evidence
      .filter((e) => e.deal === deal)
      .map((e) => ({ hash: e.hash, uploader: e.uploader ?? null, data: e.data, createdAt: e.createdAt }));
    return NextResponse.json({ evidence });
  }
  return NextResponse.json({ error: "Pass ?listingHash= or ?deal=" }, { status: 400 });
}
