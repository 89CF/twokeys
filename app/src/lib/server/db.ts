import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Tiny JSON-file stores for off-chain data. The brief suggests Supabase/Postgres; for the hackathon MVP local files
 * are enough. Each store is one file under `app/.data/` (falls back to the OS temp dir on read-only filesystems).
 */
export function createJsonStore<T extends object>(fileName: string, empty: () => T) {
  const primary = path.join(process.cwd(), ".data", fileName);
  const fallback = path.join(os.tmpdir(), `kapora-${fileName}`);
  let queue: Promise<unknown> = Promise.resolve();

  async function readFrom(file: string): Promise<T | null> {
    try {
      return { ...empty(), ...(JSON.parse(await fs.readFile(file, "utf8")) as Partial<T>) };
    } catch {
      return null;
    }
  }
  async function load(): Promise<T> {
    return (await readFrom(primary)) ?? (await readFrom(fallback)) ?? empty();
  }
  async function save(data: T): Promise<void> {
    const body = JSON.stringify(data, null, 2);
    try {
      await fs.mkdir(path.dirname(primary), { recursive: true });
      await fs.writeFile(primary, body, "utf8");
    } catch {
      await fs.writeFile(fallback, body, "utf8");
    }
  }

  return {
    /** Serialises read-modify-write cycles within this process. */
    mutate<R>(fn: (data: T) => R): Promise<R> {
      const run = queue.then(async () => {
        const data = await load();
        const result = fn(data);
        await save(data);
        return result;
      });
      queue = run.catch(() => undefined);
      return run;
    },
    async read(): Promise<T> {
      await queue.catch(() => undefined);
      return load();
    },
  };
}

// ---------------------------------------------------------------------------
// Main store: listings + evidence (with their salts). Deleting a record (and its salt) makes the on-chain hash
// unlinkable to any data.
// ---------------------------------------------------------------------------

export interface ListingRecord {
  id: string;
  hash: string;
  salt: string;
  platform?: string;
  listingId?: string;
  data: unknown;
  createdAt: string;
}
export interface EvidenceRecord {
  id: string;
  hash: string;
  salt: string;
  deal?: string;
  uploader?: string;
  data: unknown;
  createdAt: string;
}
export interface Db {
  listings: ListingRecord[];
  evidence: EvidenceRecord[];
}

const main = createJsonStore<Db>("db.json", () => ({ listings: [], evidence: [] }));
export const mutate = main.mutate;
export const readDb = main.read;
