import Link from "next/link";

/** Thin bar on the fake marketplaces making clear they are fictional third-party sites. */
export function DemoBanner({ name }: { name: string }) {
  return (
    <div className="bg-[#07080d] text-[12px] text-slate-400">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <span>
          <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 font-semibold text-slate-200">DEMO</span>
          {name} is a fictional third-party marketplace that embeds the Kapora widget.
        </span>
        <Link href="/demo" className="shrink-0 font-medium text-violet-300 hover:text-white">
          ← Back to Kapora
        </Link>
      </div>
    </div>
  );
}
