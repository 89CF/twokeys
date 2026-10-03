import { Connection, PublicKey } from "@solana/web3.js";
import { TwoKeysClient } from "@twokeys/sdk";
import { PROGRAM_ID, RPC_URL } from "@/lib/config";

let cached: { connection: Connection; client: TwoKeysClient } | null = null;

/** Server-side read-only TwoKeys client (no wallet). */
export function serverClient() {
  if (!cached) {
    const connection = new Connection(RPC_URL, "confirmed");
    cached = { connection, client: TwoKeysClient.readOnly(connection, PROGRAM_ID) };
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
