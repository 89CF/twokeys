import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { canonicalJson } from "@/lib/server/canonical";
import { mutate } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 64 * 1024;

/**
 * POST /api/hash
 * body: { data: any, kind?: "listing" | "evidence", deal?: string, uploader?: string }
 * -> { hash: hex, hashBytes: number[], salt: hex, id }
 *
 * hash = sha256(salt || canonicalJson(data)). The 16-byte salt is generated here and never goes on-chain;
 * the record (data + salt) is kept off-chain so it can be deleted later (GDPR "crypto-erasure").
 */
export async function POST(req: Request) {
  let body: { data?: unknown; kind?: string; deal?: string; uploader?: string };
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || body.data === undefined) {
    return NextResponse.json({ error: "Missing `data`" }, { status: 400 });
  }

  const salt = randomBytes(16);
  const digest = createHash("sha256").update(salt).update(Buffer.from(canonicalJson(body.data), "utf8")).digest();
  const hash = digest.toString("hex");
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const kind = body.kind === "evidence" ? "evidence" : "listing";

  try {
    await mutate((db) => {
      if (kind === "evidence") {
        db.evidence.push({
          id,
          hash,
          salt: salt.toString("hex"),
          deal: typeof body.deal === "string" ? body.deal : undefined,
          uploader: typeof body.uploader === "string" ? body.uploader : undefined,
          data: body.data,
          createdAt,
        });
      } else {
        const d = body.data as { platform?: unknown; listingId?: unknown } | null;
        db.listings.push({
          id,
          hash,
          salt: salt.toString("hex"),
          platform: typeof d?.platform === "string" ? d.platform : undefined,
          listingId: typeof d?.listingId === "string" ? d.listingId : undefined,
          data: body.data,
          createdAt,
        });
      }
    });
  } catch (e) {
    // Storage is best-effort for the MVP; the hash itself is still valid.
    console.error("[api/hash] failed to persist record", e);
  }

  return NextResponse.json({ id, hash, hashBytes: Array.from(digest), salt: salt.toString("hex") });
}
