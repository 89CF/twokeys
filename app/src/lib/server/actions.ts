import { NextResponse } from "next/server";

/** Solana Actions (Blinks) helpers: CORS + action headers required by the spec. */
export const DEVNET_BLOCKCHAIN_ID = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

export const ACTION_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
  "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
  "X-Action-Version": "2.4",
  "X-Blockchain-Ids": DEVNET_BLOCKCHAIN_ID,
  "Content-Type": "application/json",
};

export function actionJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: ACTION_HEADERS });
}

export function actionError(message: string, status = 400) {
  return actionJson({ message }, status);
}

export function actionOptions() {
  return new Response(null, { status: 204, headers: ACTION_HEADERS });
}

/** Public origin of this deployment (respects reverse-proxy headers). */
export function publicOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}
