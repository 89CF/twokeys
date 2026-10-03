import Link from "next/link";
import { ArrowRight, Camera, Car, Code2 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ListingArt } from "@/components/ListingArt";
import { CodeSnippet } from "@/components/CodeSnippet";
import { listingsFor } from "@/data/listings";
import { PLATFORM_AUTO } from "@/lib/config";

export const metadata = { title: "Demo marketplaces" };

export default function DemoHub() {
  const sites = [
    {
      href: "/demo/auto",
      name: "DemoAuto",
      desc: "A used-car marketplace. Reserve a car with a zadatek deposit before the handover.",
      icon: <Car className="h-5 w-5" />,
      listing: listingsFor("auto")[1],
      chip: "bg-[#ff6a00]",
    },
    {
      href: "/demo/rent",
      name: "DemoRent",
      desc: "Rent a camera, laptop or drone from a stranger. The security deposit comes back automatically when you return it.",
      icon: <Camera className="h-5 w-5" />,
      listing: listingsFor("rent")[0],
      chip: "bg-[#111] text-[#ffd23f]",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Try it" title="Two fake marketplaces, one protocol">
        These sites are fictional third-party platforms in two different sectors. Each embeds the same TwoKeys widget with a single script tag (same program, different template), with no
        backend integration. Open a listing and click &ldquo;Pay deposit safely with TwoKeys&rdquo;.
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {sites.map((s) => (
          <Link key={s.href} href={s.href} className="panel panel-hover group overflow-hidden">
            <ListingArt listing={s.listing} className="aspect-[16/8]" />
            <div className="p-6">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${s.chip}`}>{s.icon}</span>
                <h2 className="text-xl font-semibold text-white">{s.name}</h2>
                <ArrowRight className="ml-auto h-5 w-5 text-slate-500 transition group-hover:translate-x-1 group-hover:text-white" />
              </div>
              <p className="mt-3 text-sm text-slate-400">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <div>
          <div className="label mb-2 flex items-center gap-2 text-brand-mint/80">
            <Code2 className="h-4 w-4" /> Integration
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">One script tag. Any marketplace.</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
            The widget renders a button that opens TwoKeys in a modal (or a new tab with <code className="text-slate-300">data-mode=&quot;tab&quot;</code>).
            The platform key only feeds anonymous on-chain stats; TwoKeys never sees the platform&apos;s users.
          </p>
        </div>
        <CodeSnippet
          code={`<script src="https://your-twokeys-host/widget.js"
        data-platform="${PLATFORM_AUTO.toBase58()}"
        data-listing-id="da-2210"
        data-amount="1000"
        data-template="deposit"></script>`}
        />
      </section>
    </div>
  );
}
