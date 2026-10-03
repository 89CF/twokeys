import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";
import { ListingArt } from "@/components/ListingArt";
import { fmtPrice, listingsFor } from "@/data/listings";

export default function DemoAutoHome() {
  const cars = listingsFor("auto");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="mb-8 overflow-hidden rounded-2xl bg-[#0f1b2d] px-6 py-10 text-white sm:px-10">
        <div className="max-w-xl">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Find your next car.</h1>
          <p className="mt-3 text-slate-300">
            12,480 used cars from private sellers. Reserve with a <b className="text-white">protected deposit</b>: if the
            seller backs out, you get double back, automatically.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-[#14f195]" /> Deposits secured by Kapora Protocol
          </div>
        </div>
      </section>

      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Featured cars</h2>
        <span className="text-sm text-slate-500">{cars.length} results</span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cars.map((c) => (
          <Link
            key={c.id}
            href={`/demo/auto/${c.id}`}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <ListingArt listing={c} className="aspect-[16/10]" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold leading-snug group-hover:text-[#ff6a00]">{c.title}</h3>
              </div>
              <div className="mt-1 text-sm text-slate-500">{c.subtitle}</div>
              <div className="mt-3 flex items-end justify-between">
                <div className="text-xl font-black text-[#0f1b2d]">{fmtPrice(c.price)}</div>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> Kapora
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" /> {c.location} · {c.postedAgo}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
