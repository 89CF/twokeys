"use client";

import { useEffect, useRef } from "react";

/**
 * Embeds the vanilla /widget.js exactly like a third-party marketplace would:
 * by injecting a <script src="/widget.js" data-…> tag. The script renders the button right after itself.
 */
export function KaporaWidget(props: { platform: string; listingId: string; amount: number; template: string; mode?: "modal" | "tab" }) {
  const ref = useRef<HTMLDivElement>(null);
  const { platform, listingId, amount, template, mode } = props;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";
    const s = document.createElement("script");
    s.src = "/widget.js";
    s.async = true;
    s.dataset.platform = platform;
    s.dataset.listingId = listingId;
    s.dataset.amount = String(amount);
    s.dataset.template = template;
    if (mode) s.dataset.mode = mode;
    host.appendChild(s);
    return () => {
      host.innerHTML = "";
    };
  }, [platform, listingId, amount, template, mode]);

  return <div ref={ref} className="min-h-[76px]" />;
}
