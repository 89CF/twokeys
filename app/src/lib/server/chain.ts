import { Connection, PublicKey } from "@solana/web3.js";
import { KaporaClient } from "@kapora/sdk";
import { PROGRAM_ID, RPC_URL } from "@/lib/config";

let cached: { connection: Connection; client: KaporaClient } | null = null;

/** Server-side read-only Kapora client (no wallet). */
export function serverClient() {
  if (!cached) {
    const connection = new Connection(RPC_URL, "confirmed");
    cached = { connection, client: KaporaClient.readOnly(connection, PROGRAM_ID) };
  }
  return cached;
}

export function parseKey(s: unknown): PublicKey | null {
  if (typeof s !== "string") return null;
  try {
    return new PublicKey(s);
  } catch {
    return null;
  }
}
