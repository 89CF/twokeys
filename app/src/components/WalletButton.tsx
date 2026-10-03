"use client";

import clsx from "clsx";
import { UserRound } from "lucide-react";

/** Opens the header account menu (demo accounts + wallet apps). Used wherever an action needs a connected account. */
export function openAccountMenu() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.dispatchEvent(new Event("kapora:open-account-menu"));
}

export function WalletButton({ label = "Connect account", className }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={openAccountMenu}
      className={clsx(
        "inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-brand-violet via-brand-indigo to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(99,102,241,.8)] transition hover:brightness-110",
        className,
      )}
    >
      <UserRound className="h-4 w-4" /> {label}
    </button>
  );
}
