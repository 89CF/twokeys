#!/usr/bin/env node
// Installs a locally built LiteSVM native addon on Windows x64.
//
// litesvm@0.8.0 on npm ships no Windows binary. This script copies the
// self-built addon from vendor/litesvm-win32/ to the file name the litesvm
// napi-rs loader (litesvm/dist/internal.js) requires on win32-x64:
//   <litesvm>/dist/litesvm.win32-x64-msvc.node
// On Linux/macOS it does nothing; the official prebuilt binaries are used.
// See vendor/litesvm-win32/README.md for how the binary was built.

import { createRequire } from "node:module";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") process.exit(0);

const EXPECTED_VERSION = "0.8.0";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "vendor", "litesvm-win32", "litesvm.win32-x64-msvc.node");
const log = (msg) => console.log(`[setup-litesvm-windows] ${msg}`);

if (process.arch !== "x64") {
  log(`unsupported arch ${process.arch}; only win32-x64 binary is vendored, skipping`);
  process.exit(0);
}

let pkgJsonPath;
try {
  pkgJsonPath = createRequire(join(root, "package.json")).resolve("litesvm/package.json");
} catch {
  log("litesvm is not installed, skipping");
  process.exit(0);
}

const { version } = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
if (version !== EXPECTED_VERSION) {
  log(`installed litesvm is ${version}, vendored binary is for ${EXPECTED_VERSION}; skipping`);
  process.exit(0);
}
if (!existsSync(src)) {
  log(`vendored binary missing at ${src}; skipping`);
  process.exit(0);
}

// Same check the napi-rs loader uses to pick the -gnu vs -msvc file name.
const v = process.config?.variables ?? {};
const gnuNode = v.shlib_suffix === "dll.a" || v.node_target_type === "shared_library";
const destName = gnuNode ? "litesvm.win32-x64-gnu.node" : "litesvm.win32-x64-msvc.node";
const dest = join(dirname(pkgJsonPath), "dist", destName);

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
if (existsSync(dest) && sha(dest) === sha(src)) {
  log(`already installed: ${dest}`);
  process.exit(0);
}

try {
  copyFileSync(src, dest);
  log(`installed ${dest}`);
} catch (e) {
  // Usually EBUSY/EPERM because a running node process has the addon loaded.
  // Warn instead of failing the whole `pnpm install`; re-run this script later.
  console.warn(`[setup-litesvm-windows] WARNING: failed to copy to ${dest}: ${e.message}`);
  console.warn("[setup-litesvm-windows] close running node processes and run: node scripts/setup-litesvm-windows.mjs");
}
