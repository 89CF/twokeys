import { CopyButton } from "./ui";

export function CodeSnippet({ code, title = "index.html" }: { code: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0d14] shadow-card">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
          <span className="ml-2 font-mono text-xs text-slate-500">{title}</span>
        </div>
        <CopyButton value={code} label="Copy" />
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}
