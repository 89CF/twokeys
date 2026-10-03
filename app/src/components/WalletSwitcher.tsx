"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FlaskConical, LogOut, UserRound, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { DEMO_WALLETS_ENABLED, DEMO_WALLET_IDS, DEMO_WALLET_NAMES, demoPublicKey, isDemoWalletName, type DemoWalletId } from "@/lib/demoWallets";
import { shortAddr } from "@/lib/format";

/**
 * Header wallet control: "Acting as: Demo Seller ▾". Swaps instantly between the two devnet demo identities and any
 * browser wallet (Phantom, Solflare, other Wallet Standard wallets).
 */
export function WalletSwitcher() {
  const { wallet, wallets, publicKey, connected, connecting, select, connect, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [demoAddrs, setDemoAddrs] = useState<Record<DemoWalletId, string> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("kapora:open-account-menu", onOpen);
    return () => window.removeEventListener("kapora:open-account-menu", onOpen);
  }, []);
  useEffect(() => {
    if (!open || !DEMO_WALLETS_ENABLED || demoAddrs) return;
    setDemoAddrs(Object.fromEntries(DEMO_WALLET_IDS.map((id) => [id, demoPublicKey(id).toBase58()])) as Record<DemoWalletId, string>);
  }, [open, demoAddrs]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!mounted) return <div className="h-10 w-[170px] animate-pulse rounded-xl bg-white/[0.06]" />;

  const currentName = wallet?.adapter.name ?? null;
  const isDemo = isDemoWalletName(currentName);
  const browserWallets = wallets.filter((w) => !isDemoWalletName(w.adapter.name));

  function choose(name: WalletName) {
    setOpen(false);
    if (currentName === name) {
      if (!connected) void connect().catch(() => undefined);
      return;
    }
    select(name); // autoConnect connects the newly selected adapter
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="wallet-switcher"
        data-wallet={connected ? currentName ?? "" : ""}
        data-connected={connected ? "true" : "false"}
        data-address={publicKey?.toBase58() ?? ""}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex h-10 items-center gap-2.5 rounded-xl border pl-2 pr-3 text-sm font-medium transition",
          connected
            ? isDemo
              ? "border-amber-300/30 bg-amber-300/[0.08] text-white hover:bg-amber-300/[0.14]"
              : "border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.09]"
            : "border-transparent bg-gradient-to-br from-brand-violet via-brand-indigo to-indigo-600 pl-3 text-white shadow-[0_8px_24px_-10px_rgba(99,102,241,.8)] hover:brightness-110",
        )}
      >
        {connected && wallet ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wallet.adapter.icon} alt="" className="h-6 w-6 rounded-md" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Acting as</span>
              <span className="whitespace-nowrap">
                {currentName} <span className="font-mono text-xs text-slate-400">{shortAddr(publicKey, 3)}</span>
              </span>
            </span>
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            <span className="whitespace-nowrap">{connecting ? "Connecting…" : "Connect account"}</span>
          </>
        )}
        <ChevronDown className={clsx("h-4 w-4 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[320px] animate-fade-up overflow-hidden rounded-2xl border border-white/10 bg-ink-800 shadow-2xl shadow-black/60">
          {DEMO_WALLETS_ENABLED && (
            <div className="border-b border-white/[0.06] p-2">
              <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
                <FlaskConical className="h-3.5 w-3.5" /> Demo accounts
              </div>
              {DEMO_WALLET_IDS.map((id) => {
                const name = DEMO_WALLET_NAMES[id];
                const active = connected && currentName === name;
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid={`switch-demo-${id}`}
                    onClick={() => choose(name)}
                    className={clsx("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", active ? "bg-white/[0.07]" : "hover:bg-white/[0.05]")}
                  >
                    <span
                      className={clsx(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white",
                        id === "seller"
                          ? "bg-gradient-to-br from-brand-violet to-brand-indigo"
                          : id === "buyer"
                            ? "bg-gradient-to-br from-sky-500 to-brand-mint"
                            : "bg-gradient-to-br from-slate-500 to-slate-700",
                      )}
                    >
                      {id === "seller" ? "S" : id === "buyer" ? "B" : "V"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-white">
                        {name}
                        {id === "visitor" && <span className="ml-1.5 text-[11px] font-normal text-slate-500">not part of any deal</span>}
                      </span>
                      <span className="block font-mono text-[11px] text-slate-500">{demoAddrs ? shortAddr(demoAddrs[id], 6) : "…"}</span>
                    </span>
                    {active && <Check className="h-4 w-4 text-brand-mint" />}
                  </button>
                );
              })}
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] leading-snug text-amber-200/70">
                Demo account: devnet only, keys stored in this browser. Fund them on the{" "}
                <Link href="/dev/faucet" onClick={() => setOpen(false)} className="underline underline-offset-2">
                  faucet
                </Link>
                .
              </p>
            </div>
          )}

          <div className="border-b border-white/[0.06] p-2">
            <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your own Solana wallet app</div>
            {browserWallets.map((w) => {
              const active = connected && currentName === w.adapter.name;
              const installed = w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable;
              return (
                <button
                  key={w.adapter.name}
                  type="button"
                  onClick={() => choose(w.adapter.name)}
                  className={clsx("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", active ? "bg-white/[0.07]" : "hover:bg-white/[0.05]")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.adapter.icon} alt="" className="h-8 w-8 rounded-lg" />
                  <span className="flex-1 text-sm font-medium text-white">{w.adapter.name}</span>
                  {active ? <Check className="h-4 w-4 text-brand-mint" /> : !installed && <span className="text-[11px] text-slate-500">Not installed</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setVisible(true);
              }}
              className="mt-0.5 w-full rounded-xl px-2.5 py-2 text-left text-sm text-slate-400 hover:bg-white/[0.05] hover:text-white"
            >
              Other wallet apps…
            </button>
          </div>

          {connected && publicKey && (
            <div className="flex gap-1 p-2">
              <Link
                href={`/profile/${publicKey.toBase58()}`}
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white"
              >
                <UserRound className="h-4 w-4" /> Profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void disconnect();
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white"
              >
                <LogOut className="h-4 w-4" /> Disconnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
