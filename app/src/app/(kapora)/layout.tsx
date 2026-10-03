import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export default function KaporaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute left-1/2 top-[-260px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand-violet/20 blur-[120px]" />
        <div className="absolute right-[-120px] top-[60px] h-[300px] w-[420px] rounded-full bg-brand-mint/10 blur-[110px]" />
      </div>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
