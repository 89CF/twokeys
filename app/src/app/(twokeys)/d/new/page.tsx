"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OfferForm } from "@/components/OfferForm";
import { OfferIntro } from "@/components/OfferIntro";
import { Skeleton } from "@/components/ui";
import { getListing } from "@/data/listings";
import { PLATFORM_AUTO, PLATFORM_RENT } from "@/lib/config";
import { parsePubkey } from "@/lib/format";
import { TEMPLATES, parseTemplate } from "@/lib/templates";

function NewDealInner() {
  const sp = useSearchParams();
  const listingId = sp.get("listing") ?? "";
  const listing = getListing(listingId);
  const template = parseTemplate(sp.get("template") ?? listing?.template);
  const amount = Number(sp.get("amount") ?? listing?.deposit ?? 0) || 0;
  const platform =
    parsePubkey(sp.get("platform")) ?? (listing?.site === "rent" ? PLATFORM_RENT : PLATFORM_AUTO);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <OfferIntro tpl={TEMPLATES[template]} />

      <OfferForm platform={platform} listingId={listingId} listing={listing} amount={amount} template={template} />
    </div>
  );
}

export default function NewDealPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <NewDealInner />
    </Suspense>
  );
}
