// Copies the IDL + TS types produced by `anchor build` into the SDK.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "sdk/src/idl"), { recursive: true });
copyFileSync(join(root, "target/idl/kapora.json"), join(root, "sdk/src/idl/kapora.json"));
copyFileSync(join(root, "target/types/kapora.ts"), join(root, "sdk/src/idl/kapora.ts"));
console.log("IDL synced to sdk/src/idl");
