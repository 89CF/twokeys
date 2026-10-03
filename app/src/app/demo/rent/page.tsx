import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";
import { ListingArt } from "@/components/ListingArt";
import { fmtPrice, listingsFor } from "@/data/listings";

export default function DemoRentHome() {
  const items = listingsFor("rent");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <section className="mb-10 grid items-end gap-6 md:grid-cols-[1.4fr_1fr]">
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Rent gear from people <span className="rounded-xl bg-[#ffd23f] px-2">nearby</span>.
        </h1>
        <div className="text-[15px] leading-relaxed text-black/60">
          Cameras, laptops, drones and more. Your security deposit is locked in a smart contract, not sent to a stranger.
          Return the item, confirm, and it comes back automatically.
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#111] px-3 py-1.5 text-xs font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#ffd23f]" /> Deposits secured by TwoKeys
          </div>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Link key={it.id} href={`/demo/rent/${it.id}`} className="group overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_rgba(0,0,0,.06)] transition hover:-translate-y-1 hover:shadow-xl">
            <ListingArt listing={it} className="aspect-[4/3]" />
            <div className="p-5">
              <h3 className="font-bold leading-snug">{it.title}</h3>
              <div className="mt-1 text-sm text-black/50">{it.subtitle}</div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <span className="text-2xl font-black">{fmtPrice(it.price)}</span>
                  <span className="text-sm text-black/50"> / day</span>
                </div>
                <span className="rounded-full bg-[#ffd23f]/60 px-2.5 py-1 text-[11px] font-bold">deposit {fmtPrice(it.deposit)}</span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-black/50">
                <MapPin className="h-3.5 w-3.5" /> {it.location}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
