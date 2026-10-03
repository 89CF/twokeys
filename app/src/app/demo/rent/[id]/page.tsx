import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Check, MapPin, RotateCcw, User } from "lucide-react";
import { ListingArt } from "@/components/ListingArt";
import { KaporaWidget } from "@/components/KaporaWidget";
import { fmtPrice, getListing, listingsFor } from "@/data/listings";
import { PLATFORM_RENT } from "@/lib/config";

export function generateStaticParams() {
  return listingsFor("rent").map((l) => ({ id: l.id }));
}

export default async function DemoRentListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getListing(id);
  if (!item || item.site !== "rent") notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/demo/rent" className="text-sm font-semibold text-black/50 hover:text-black">
        ← All gear
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div>
          <div className="overflow-hidden rounded-[28px]">
            <ListingArt listing={item} className="aspect-[16/10]" />
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">{item.title}</h1>
          <div className="mt-1 text-black/60">{item.subtitle}</div>
          <div className="mt-2 flex items-center gap-1 text-sm text-black/50">
            <MapPin className="h-4 w-4" /> {item.location}
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {item.specs.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white p-4">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-black/40">{s.label}</dt>
                <dd className="mt-1 font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 leading-relaxed text-black/70">{item.description}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {item.highlights.map((h) => (
              <li key={h} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold">
                <Check className="h-3.5 w-3.5" /> {h}
              </li>
            ))}
          </ul>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[28px] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,.35)]">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-black">{fmtPrice(item.price)}</span>
                <span className="text-black/50"> / day</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-black/50">
                <User className="h-3.5 w-3.5" /> {item.seller.name}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-black/10 text-sm">
              <div className="border-r border-black/10 p-3">
                <div className="flex items-center gap-1 text-[11px] font-bold uppercase text-black/40">
                  <CalendarDays className="h-3 w-3" /> Pick-up
                </div>
                <div className="font-semibold">Sat, 10:00</div>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1 text-[11px] font-bold uppercase text-black/40">
                  <RotateCcw className="h-3 w-3" /> Return
                </div>
                <div className="font-semibold">Sun, 18:00</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-[#ffd23f]/30 p-4">
              <div className="text-sm font-black">Refundable security deposit: {fmtPrice(item.deposit)}</div>
              <p className="mt-1 text-xs leading-relaxed text-black/60">
                Locked in a smart contract. Return the item and confirm; if the owner doesn&apos;t object in time, it comes back
                to you automatically. The rental fee is paid separately.
              </p>
              <div className="mt-3">
                <KaporaWidget platform={PLATFORM_RENT.toBase58()} listingId={item.id} amount={item.deposit} template="rental" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
