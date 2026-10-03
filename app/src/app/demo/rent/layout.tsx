import type { Metadata } from "next";
import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";

export const metadata: Metadata = { title: "DemoRent: rent gear from people nearby" };

function RentLogo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111] text-[#ffd23f]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </span>
      <span className="text-[22px] font-black tracking-tight text-[#111]">
        demo<span className="rounded-md bg-[#ffd23f] px-1">rent</span>
      </span>
    </span>
  );
}

export default function DemoRentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f5f1] text-[#111] [color-scheme:light]">
      <DemoBanner name="DemoRent" />
      <header className="border-b border-black/10 bg-[#f6f5f1]">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-8 px-4 sm:px-6">
          <Link href="/demo/rent">
            <RentLogo />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-semibold md:flex">
            {["Cameras", "Laptops", "Drones", "Audio", "Camping"].map((c, i) => (
              <span key={c} className={i === 0 ? "rounded-full bg-[#111] px-3.5 py-1.5 text-white" : "rounded-full px-3.5 py-1.5 text-black/50"}>
                {c}
              </span>
            ))}
          </nav>
          <span className="ml-auto rounded-full bg-[#ffd23f] px-4 py-2 text-sm font-bold text-[#111]">Lend your gear</span>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-black/10">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-black/50 sm:px-6">
          DemoRent (fictional). Security deposits are held by the Kapora Protocol smart contract, not by DemoRent or the owner.
        </div>
      </footer>
    </div>
  );
}
