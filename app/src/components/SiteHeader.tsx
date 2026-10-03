"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Logo } from "./Logo";
import { WalletSwitcher } from "./WalletSwitcher";
import { useEmbedded } from "@/hooks/useEmbedded";

const NAV = [
  { href: "/demo", label: "Demos" },
  { href: "/offer/new", label: "Create offer" },
  { href: "/stats", label: "Stats" },
  { href: "/arbiter", label: "Arbiter" },
  { href: "/dev/faucet", label: "Faucet" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const embedded = useEmbedded();
  const { publicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const nav = publicKey ? [...NAV, { href: `/profile/${publicKey.toBase58()}`, label: "My profile" }] : NAV;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" target={embedded ? "_blank" : undefined}>
          <Logo />
        </Link>
        {!embedded && (
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((n) => {
              const active = pathname === n.href || (n.href !== "/" && pathname?.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={clsx(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    active ? "bg-white/[0.07] text-white" : "text-slate-400 hover:text-white",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200 xl:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Devnet
          </span>
          <WalletSwitcher />
          {!embedded && (
            <button
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>
      {open && !embedded && (
        <nav className="border-t border-white/[0.06] px-4 py-3 lg:hidden">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const embedded = useEmbedded();
  if (embedded) return null;
  return (
    <footer className="mt-24 border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="scale-90" />
        </div>
        <p className="max-w-md">
          Hackathon prototype on Solana devnet. Test tokens only. Legal templates are design assumptions, not legal advice.
        </p>
        <div className="flex gap-4">
          <Link href="/stats" className="hover:text-white">Privacy &amp; stats</Link>
          <Link href="/dev/faucet" className="hover:text-white">Faucet</Link>
        </div>
      </div>
    </footer>
  );
}
