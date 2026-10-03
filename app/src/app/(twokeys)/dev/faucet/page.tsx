"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { Coins, Droplet, ExternalLink, FlaskConical, Puzzle, Settings, Wallet } from "lucide-react";
import { useTwoKeys } from "@/hooks/useTwoKeys";
import { useBalances } from "@/hooks/useTokenBalance";
import { Address, Button, Callout, Card, PageHeader } from "@/components/ui";
import { WalletButton } from "@/components/WalletButton";
import { FAUCET_AMOUNT, USDC_MINT, USDC_MINT_CONFIGURED } from "@/lib/config";
import { explorerTx, fmtNumber, shortAddr } from "@/lib/format";
import { DEMO_WALLETS_ENABLED, DEMO_WALLET_IDS, DEMO_WALLET_NAMES, demoPublicKey, type DemoWalletId } from "@/lib/demoWallets";

interface FaucetResult {
  error?: string;
  signature?: string;
  solTransfer?: string | null;
  solLamports?: number;
  solError?: string | null;
  airdrop?: string | null;
}

async function requestFaucet(wallet: string): Promise<FaucetResult & { signature: string }> {
  const res = await fetch("/api/faucet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  const j = (await res.json().catch(() => ({}))) as FaucetResult;
  if (!res.ok || !j.signature) throw new Error(j.error ?? `Faucet failed (${res.status})`);
  return j as FaucetResult & { signature: string };
}

function solNote(j: FaucetResult): string {
  if (j.solTransfer) return ` · +${(j.solLamports ?? 0) / 1e9} SOL for fees`;
  if (j.airdrop) return " · +1 devnet SOL airdropped";
  if (j.solError) return " · SOL top-up failed (faucet keypair low on SOL?)";
  return " · SOL balance already sufficient";
}

export default function FaucetPage() {
  const { wallet, connected } = useTwoKeys();
  const balances = useBalances(wallet);
  const [busy, setBusy] = useState(false);

  async function mint() {
    if (!wallet) return;
    setBusy(true);
    const id = toast.loading("Minting test USDC…");
    try {
      const j = await requestFaucet(wallet.toBase58());
      toast.success(`${fmtNumber(FAUCET_AMOUNT)} test USDC sent`, {
        id,
        description: (
          <span>
            <a className="underline" href={explorerTx(j.signature)} target="_blank" rel="noreferrer">
              View transaction ↗
            </a>
            {solNote(j)}
          </span>
        ),
        duration: 8000,
      });
      setTimeout(() => void balances.refresh(), 1500);
    } catch (e) {
      toast.error("Faucet failed", { id, description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Devnet only" title="Test USDC faucet">
        Get free test tokens to try TwoKeys. They have no value and only exist on Solana devnet.
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <Card className="relative overflow-hidden p-8">
          <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-mint/10 blur-3xl" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white">
            <Droplet className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-white">Mint {fmtNumber(FAUCET_AMOUNT)} test USDC</h2>
          <p className="mt-2 text-sm text-slate-400">If the account has less than 0.01 SOL, we also send it 0.03 devnet SOL for fees (about 7 deals).</p>

          {connected && wallet ? (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Test USDC</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-white">{balances.data ? fmtNumber(balances.data.usdc) : "…"}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Devnet SOL</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-white">{balances.data ? fmtNumber(balances.data.sol, 3) : "…"}</div>
                </div>
              </div>
              <Button size="lg" className="mt-6 w-full" onClick={mint} loading={busy} disabled={!USDC_MINT_CONFIGURED}>
                <Coins className="h-4 w-4" /> Mint {fmtNumber(FAUCET_AMOUNT)} test USDC
              </Button>
              <p className="mt-3 text-center text-xs text-slate-500">
                To <span className="font-mono">{wallet.toBase58().slice(0, 6)}…</span> ·{" "}
                <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  official SOL faucet ↗
                </a>
              </p>
            </>
          ) : (
            <div className="mt-6 flex flex-col items-start gap-2">
              <WalletButton />
              <span className="text-xs text-slate-500">Connect an account to receive tokens.</span>
            </div>
          )}
          {!USDC_MINT_CONFIGURED && (
            <Callout tone="warn" className="mt-6" title="Faucet not configured">
              Set <code>NEXT_PUBLIC_USDC_MINT</code> and <code>FAUCET_SECRET_KEY</code> in <code>app/.env.local</code>.
            </Callout>
          )}
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            Mint: <Address value={USDC_MINT} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-white">First time? Set up in 1 minute</h3>
          <ol className="mt-5 space-y-5 text-sm">
            <Step n={1} icon={<Puzzle className="h-4 w-4" />} title="Optional: install a wallet app">
              <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:text-white">
                Phantom <ExternalLink className="h-3 w-3" />
              </a>{" "}
              or{" "}
              <a href="https://solflare.com/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:text-white">
                Solflare <ExternalLink className="h-3 w-3" />
              </a>{" "}
              browser extension.
            </Step>
            <Step n={2} icon={<Settings className="h-4 w-4" />} title="Switch to Devnet">
              Phantom: Settings → Developer Settings → Testnet Mode → Solana Devnet. Solflare: Settings → Network → Devnet.
            </Step>
            <Step n={3} icon={<Wallet className="h-4 w-4" />} title="Connect & mint">
              Connect with the button, then mint test USDC. Use two different wallets (or browser profiles) to play buyer and seller.
            </Step>
          </ol>
        </Card>
      </div>

      {DEMO_WALLETS_ENABLED && <DemoWalletsFunding />}
    </div>
  );
}

/** Funds both devnet demo identities (Demo Seller + Demo Buyer) in one click. */
function DemoWalletsFunding() {
  const [addrs, setAddrs] = useState<Record<DemoWalletId, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ state: "idle" | "done" | "error"; text: string }>({ state: "idle", text: "" });
  useEffect(() => setAddrs(Object.fromEntries(DEMO_WALLET_IDS.map((id) => [id, demoPublicKey(id).toBase58()])) as Record<DemoWalletId, string>), []);
  const seller = useBalances(addrs ? new PublicKey(addrs.seller) : null);
  const buyer = useBalances(addrs ? new PublicKey(addrs.buyer) : null);
  const visitor = useBalances(addrs ? new PublicKey(addrs.visitor) : null);

  async function fundAll() {
    if (!addrs) return;
    setBusy(true);
    setStatus({ state: "idle", text: "" });
    const id = toast.loading("Funding the demo accounts…");
    const lines: string[] = [];
    let failed = 0;
    for (const [i, who] of DEMO_WALLET_IDS.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1200)); // stay under public RPC rate limits
      try {
        const j = await requestFaucet(addrs[who]);
        lines.push(`${DEMO_WALLET_NAMES[who]}: +${fmtNumber(FAUCET_AMOUNT)} USDC${solNote(j)}`);
      } catch (e) {
        failed++;
        lines.push(`${DEMO_WALLET_NAMES[who]}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const text = lines.join("\n");
    if (failed === DEMO_WALLET_IDS.length) toast.error("Funding failed", { id, description: <span className="whitespace-pre-line">{text}</span>, duration: 9000 });
    else toast.success(failed ? "Partly funded" : "Demo accounts funded", { id, description: <span className="whitespace-pre-line">{text}</span>, duration: 8000 });
    setStatus({ state: failed === DEMO_WALLET_IDS.length ? "error" : "done", text });
    setBusy(false);
    setTimeout(() => {
      void seller.refresh();
      void buyer.refresh();
      void visitor.refresh();
    }, 1500);
  }

  const rows: { id: DemoWalletId; q: typeof seller }[] = [
    { id: "seller", q: seller },
    { id: "buyer", q: buyer },
    { id: "visitor", q: visitor },
  ];

  return (
    <Card className="mt-6 border-amber-300/20 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-lg">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <FlaskConical className="h-4 w-4 text-amber-200" /> Demo accounts
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Three in-browser identities: one person can play both sides, and the visitor shows that anyone can apply the outcome after
            a deadline. Switch with the &ldquo;Acting as&rdquo; menu in the header. <span className="text-amber-200/80">Devnet only, keys stored in this browser.</span>
          </p>
        </div>
        <Button onClick={fundAll} loading={busy} disabled={!addrs || !USDC_MINT_CONFIGURED} data-testid="fund-demo-wallets" className="shrink-0">
          <Coins className="h-4 w-4" /> Fund demo accounts
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {rows.map(({ id, q }) => (
          <div key={id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div>
              <div className="text-sm font-medium text-white">{DEMO_WALLET_NAMES[id]}</div>
              <div className="font-mono text-[11px] text-slate-500">{addrs ? shortAddr(addrs[id], 6) : "…"}</div>
            </div>
            <div className="text-right text-xs tabular-nums text-slate-300" data-testid={`demo-balance-${id}`}>
              <div>{q.data ? `${fmtNumber(q.data.usdc)} USDC` : "…"}</div>
              <div className="text-slate-500">{q.data ? `${fmtNumber(q.data.sol, 3)} SOL` : ""}</div>
            </div>
          </div>
        ))}
      </div>
      <pre data-testid="fund-demo-status" data-state={status.state} className={status.text ? "mt-4 whitespace-pre-wrap rounded-xl bg-ink-900 p-3 text-xs text-slate-400" : "hidden"}>
        {status.text}
      </pre>
    </Card>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">{icon}</span>
      <div>
        <div className="font-medium text-white">
          <span className="text-slate-500">{n}.</span> {title}
        </div>
        <div className="mt-0.5 leading-relaxed text-slate-400">{children}</div>
      </div>
    </li>
  );
}
