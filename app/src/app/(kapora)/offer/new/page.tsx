"use client";

import clsx from "clsx";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, Camera, CircleCheck, KeyRound, ShoppingBag } from "lucide-react";
import { OfferForm } from "@/components/OfferForm";
import { OfferIntro } from "@/components/OfferIntro";
import { ListingArt } from "@/components/ListingArt";
import { Skeleton } from "@/components/ui";
import { LISTINGS, fmtPrice } from "@/data/listings";
import { PLATFORM_AUTO, PLATFORM_RENT } from "@/lib/config";
import { TEMPLATES, TEMPLATE_KEYS, parseTemplate, type TemplateKey } from "@/lib/templates";

const ICONS: Record<TemplateKey, React.ReactNode> = {
  deposit: <KeyRound className="h-5 w-5" />,
  rental: <Camera className="h-5 w-5" />,
  freelance: <Briefcase className="h-5 w-5" />,
  purchase: <ShoppingBag className="h-5 w-5" />,
};

function OfferNewInner() {
  const sp = useSearchParams();
  const [template, setTemplate] = useState<TemplateKey>(parseTemplate(sp.get("template")));
  const [listingId, setListingId] = useState<string | null>(null);
  const tpl = TEMPLATES[template];
  const listings = LISTINGS.filter((l) => l.template === template);
  const listing = listings.find((l) => l.id === listingId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <OfferIntro tpl={tpl} eyebrow="Create an offer" />

      <div className="label mb-3">1 · Choose a template (same program, different rules)</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATE_KEYS.map((k) => {
          const t = TEMPLATES[k];
          const active = k === template;
          return (
            <button
              key={k}
              type="button"
              data-testid={`template-${k}`}
              onClick={() => {
                setTemplate(k);
                setListingId(null);
              }}
              className={clsx("panel panel-hover p-4 text-left", active && "!border-brand-violet/60 ring-4 ring-brand-violet/10")}
            >
              <div className="flex items-center justify-between">
                <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-brand-gradient text-white" : "bg-white/[0.05] text-slate-300")}>
                  {ICONS[k]}
                </span>
                {active && <CircleCheck className="h-5 w-5 text-brand-mint" />}
              </div>
              <div className="mt-3 font-semibold text-white">{t.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-400">{t.tagline}</div>
              <div className="mt-2 text-[11px] text-slate-500">
                {t.roles.payee} ↔ {t.roles.payer}
              </div>
            </button>
          );
        })}
      </div>

      {listings.length > 0 && (
        <>
          <div className="label mb-3 mt-8">2 · Link a demo listing (optional)</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const active = l.id === listingId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setListingId(active ? null : l.id)}
                  className={clsx("panel panel-hover flex items-center gap-3 p-3 text-left", active && "!border-brand-violet/60 ring-4 ring-brand-violet/10")}
                >
                  <ListingArt listing={l} className="h-14 w-20 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{l.title}</div>
                    <div className="text-xs text-slate-400">
                      {l.site === "auto" ? "DemoAuto" : "DemoRent"} · {tpl.amountLabel} {fmtPrice(l.deposit)}
                    </div>
                  </div>
                  {active && <CircleCheck className="h-5 w-5 shrink-0 text-brand-mint" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="pt-10">
        <div className="label mb-3">{listings.length > 0 ? "3" : "2"} · Set the terms</div>
        <OfferForm
          key={`${template}:${listing?.id ?? "none"}`}
          platform={listing?.site === "rent" || (!listing && template === "rental") ? PLATFORM_RENT : PLATFORM_AUTO}
          listingId={listing?.id ?? ""}
          listing={listing}
          amount={listing?.deposit ?? (template === "freelance" ? 800 : 500)}
          template={template}
        />
      </div>
    </div>
  );
}

export default function OfferNewPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><Skeleton className="h-64" /></div>}>
      <OfferNewInner />
    </Suspense>
  );
}
