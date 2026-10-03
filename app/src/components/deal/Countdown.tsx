"use client";

import clsx from "clsx";
import { Clock } from "lucide-react";
import { fmtCountdown, fmtDateTime } from "@/lib/format";

/** Deadline tile with a live countdown. */
export function Countdown({ label, at, now, hint, active = true }: { label: string; at: number; now: number; hint?: string; active?: boolean }) {
  const left = at - now;
  const passed = left <= 0;
  const urgent = !passed && left <= 30;
  return (
    <div
      className={clsx(
        "rounded-2xl border p-4 transition",
        !active && "opacity-50",
        passed ? "border-white/[0.06] bg-white/[0.02]" : urgent ? "border-amber-400/30 bg-amber-400/[0.06]" : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <Clock className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={clsx("mt-1.5 font-mono text-2xl font-semibold tabular-nums", passed ? "text-slate-500" : urgent ? "text-amber-200" : "text-white")}>
        {passed ? "passed" : fmtCountdown(left)}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{hint ?? fmtDateTime(at)}</div>
    </div>
  );
}
