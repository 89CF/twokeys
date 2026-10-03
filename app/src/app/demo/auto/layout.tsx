import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { DemoBanner } from "@/components/DemoBanner";

export const metadata: Metadata = { title: "DemoAuto: used cars" };

function AutoLogo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#ff6a00] text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h.5A1.5 1.5 0 0 1 21 12.5V17h-2v1.5a1.5 1.5 0 0 1-3 0V17H8v1.5a1.5 1.5 0 0 1-3 0V17H3v-4.5A1.5 1.5 0 0 1 4.5 11H5zm2.1 0h9.8l-1-3.2a.8.8 0 0 0-.8-.6H8.9a.8.8 0 0 0-.8.6L7.1 11zM6.5 15a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zm11 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z" />
        </svg>
      </span>
      <span className="text-xl font-black tracking-tight text-[#0f1b2d]">
        Demo<span className="text-[#ff6a00]">Auto</span>
      </span>
    </span>
  );
}

export default function DemoAutoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f5f8] font-sans text-[#0f1b2d] [color-scheme:light]">
      <DemoBanner name="DemoAuto" />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/demo/auto">
            <AutoLogo />
          </Link>
          <div className="hidden flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 md:flex">
            <Search className="h-4 w-4" /> Search make, model or keyword…
          </div>
          <nav className="ml-auto hidden items-center gap-5 text-sm font-semibold text-slate-600 sm:flex">
            <Link href="/demo/auto" className="hover:text-[#ff6a00]">Cars</Link>
            <span className="cursor-default text-slate-400">Motorbikes</span>
            <span className="cursor-default text-slate-400">Vans</span>
          </nav>
          <span className="rounded-lg bg-[#ff6a00] px-4 py-2 text-sm font-bold text-white shadow-sm">+ Post an ad</span>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-500 sm:px-6">
          © 2026 DemoAuto (fictional). Deposits on this site are protected by the Kapora Protocol widget.
        </div>
      </footer>
    </div>
  );
}
