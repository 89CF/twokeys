// Copies the embeddable widget into the Next.js app so it is served at /widget.js.
// Run automatically by `pnpm --filter @kapora/app dev|build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "widget.js");
const dest = join(here, "..", "app", "public", "widget.js");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[kapora] widget copied -> ${dest}`);
