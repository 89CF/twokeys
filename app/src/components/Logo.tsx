import clsx from "clsx";

/** Kapora mark: two interlocking locks (mutual collateral) inside a gradient tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-brand-gradient shadow-[0_6px_20px_-6px_rgba(99,102,241,.9)]",
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]" fill="none" aria-hidden="true">
        <path
          d="M16 3.5c3.2 2.2 6.6 3.3 10 3.4v8.3c0 6.6-4.2 11.1-10 13.3C10.2 26.3 6 21.8 6 15.2V6.9c3.4-.1 6.8-1.2 10-3.4Z"
          stroke="white"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <circle cx="13" cy="15.5" r="3.6" stroke="white" strokeWidth="2.2" />
        <circle cx="19" cy="15.5" r="3.6" stroke="white" strokeWidth="2.2" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-white">
        Kapora<span className="ml-1 font-normal text-slate-500">Protocol</span>
      </span>
    </span>
  );
}
