import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, MapPin, Phone, ShieldCheck, TriangleAlert, User } from "lucide-react";
import { ListingArt } from "@/components/ListingArt";
import { KaporaWidget } from "@/components/KaporaWidget";
import { fmtPrice, getListing, listingsFor } from "@/data/listings";
import { PLATFORM_AUTO } from "@/lib/config";

export function generateStaticParams() {
  return listingsFor("auto").map((l) => ({ id: l.id }));
}

export default async function DemoAutoListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const car = getListing(id);
  if (!car || car.site !== "auto") notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/demo/auto" className="hover:text-[#ff6a00]">Cars</Link> <span className="mx-1">/</span>
        <span className="text-slate-700">{car.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ListingArt listing={car} className="aspect-[16/9]" />
            <div className="grid grid-cols-4 gap-2 p-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="overflow-hidden rounded-md opacity-80" style={{ filter: `hue-rotate(${i * 12}deg) brightness(${1 - i * 0.08})` }}>
                  <ListingArt listing={car} className="aspect-[16/10]" />
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">Specification</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {car.specs.map((s) => (
                <div key={s.label} className="border-b border-slate-100 pb-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{s.label}</dt>
                  <dd className="font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-5 flex flex-wrap gap-2">
              {car.highlights.map((h) => (
                <li key={h} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> {h}
                </li>
              ))}
            </ul>
            <h2 className="mb-2 mt-6 text-lg font-bold">Description</h2>
            <p className="leading-relaxed text-slate-600">{car.description}</p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h1 className="text-xl font-bold leading-tight">{car.title}</h1>
            <div className="mt-1 text-sm text-slate-500">{car.subtitle}</div>
            <div className="mt-4 text-3xl font-black text-[#0f1b2d]">{fmtPrice(car.price)}</div>
            <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-4 w-4" /> {car.location}
            </div>

            <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="mb-1 text-sm font-bold text-[#0f1b2d]">Reserve this car</div>
              <p className="mb-3 text-xs leading-relaxed text-slate-600">
                Reservation deposit: <b>{fmtPrice(car.deposit)}</b>. The deposit is locked in a smart contract, not sent to
                the seller. The seller locks the same amount, so backing out costs them double.
              </p>
              <KaporaWidget platform={PLATFORM_AUTO.toBase58()} listingId={car.id} amount={car.deposit} template="deposit" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <div className="font-bold">{car.seller.name}</div>
                <div className="text-xs text-slate-500">Private seller · on DemoAuto since {car.seller.memberSince}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
              <Phone className="h-4 w-4" /> Show phone number
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <TriangleAlert className="h-5 w-5 shrink-0 text-amber-500" />
            <p>
              <b>Safety tip:</b> never send a deposit by bank transfer to someone you haven&apos;t met. Use the{" "}
              <span className="inline-flex items-center gap-0.5 font-bold">
                <ShieldCheck className="h-3 w-3" /> Kapora
              </span>{" "}
              button: the rules execute themselves.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
