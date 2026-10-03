"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, Copy, ExternalLink, LoaderCircle, X } from "lucide-react";
import type { PublicKey } from "@solana/web3.js";
import { explorerAddress, shortAddr } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-brand-violet via-brand-indigo to-indigo-600 text-white shadow-[0_10px_30px_-12px_rgba(99,102,241,.9)] hover:brightness-110",
  secondary: "border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08] hover:border-white/20",
  ghost: "text-slate-300 hover:bg-white/[0.06] hover:text-white",
  danger: "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  success: "bg-gradient-to-br from-emerald-400 to-teal-500 text-ink shadow-[0_10px_30px_-12px_rgba(20,241,149,.7)] hover:brightness-110",
  warning: "border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-[15px] rounded-xl gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex select-none items-center justify-center font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls = clsx("inline-flex items-center justify-center font-semibold transition", VARIANTS[variant], SIZES[size], className);
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("panel", className)}>{children}</div>;
}

type Tone = "good" | "warn" | "bad" | "neutral" | "brand" | "info";
const TONES: Record<Tone, string> = {
  good: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  bad: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  neutral: "border-white/10 bg-white/[0.04] text-slate-300",
  brand: "border-brand-violet/30 bg-brand-violet/10 text-violet-200",
  info: "border-sky-400/25 bg-sky-400/10 text-sky-200",
};

export function Badge({ tone = "neutral", className, children, dot }: { tone?: Tone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Callout({ tone = "info", icon, title, children, className }: { tone?: Tone; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex gap-3 rounded-2xl border p-4 text-sm", TONES[tone], className)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0 space-y-1">
        {title && <div className="font-semibold text-white">{title}</div>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true));
      }}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white",
        className,
      )}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}

export function Address({ value, href, chars = 4, className }: { value: PublicKey | string; href?: string; chars?: number; className?: string }) {
  const s = typeof value === "string" ? value : value.toBase58();
  return (
    <span className={clsx("inline-flex items-center gap-0.5 font-mono text-[13px]", className)}>
      {href ? (
        <Link href={href} className="text-slate-200 underline decoration-white/20 underline-offset-4 hover:decoration-white/60">
          {shortAddr(s, chars)}
        </Link>
      ) : (
        <span className="text-slate-200">{shortAddr(s, chars)}</span>
      )}
      <CopyButton value={s} className="px-1" />
      <a href={explorerAddress(s)} target="_blank" rel="noreferrer" className="rounded-lg p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white" title="Open in Solana Explorer">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={clsx("h-5 w-5 animate-spin text-slate-400", className)} />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300">{icon}</div>}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-slate-400">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, right }: { eyebrow?: string; title: ReactNode; children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <div className="label mb-2 text-brand-mint/80">{eyebrow}</div>}
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        {children && <div className="mt-3 text-[15px] leading-relaxed text-slate-400">{children}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-full max-w-md animate-fade-up p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** USDC amount with PLN equivalent underneath. */
export function Amount({ usdc, pln, size = "md", className }: { usdc: string; pln?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "text-base", md: "text-xl", lg: "text-2xl", xl: "text-4xl" };
  return (
    <div className={className}>
      <div className={clsx("font-semibold tabular-nums tracking-tight text-white", sizes[size])}>{usdc}</div>
      {pln && <div className="mt-0.5 text-xs text-slate-500">≈ {pln}</div>}
    </div>
  );
}
