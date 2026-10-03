/**
 * Mint test USDC to any wallet on devnet.
 * Usage: pnpm devnet:faucet <WALLET_PUBKEY> [amount=1000]
 */
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

import { connection, namedKeypair, cliWalletKeypair, pk, readDeployment } from "./common";

async function main() {
  const [wallet, amountArg] = process.argv.slice(2);
  if (!wallet) throw new Error("usage: faucet <WALLET_PUBKEY> [amount]");
  const amount = BigInt(Math.round(Number(amountArg ?? 1000) * 1e6));
  const dep = readDeployment();
  const conn = connection();
  const funder = cliWalletKeypair();
  const authority = namedKeypair("usdc-mint-authority");
  const mint = pk(dep.usdcMint);
  const ata = await getOrCreateAssociatedTokenAccount(conn, funder, mint, pk(wallet));
  const sig = await mintTo(conn, funder, mint, ata.address, authority, amount);
  console.log(`minted ${Number(amount) / 1e6} test USDC to ${wallet}: ${sig}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
