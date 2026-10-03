"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { payout, type UiDeal } from "@/lib/model";
import { Button, Modal } from "@/components/ui";
import { fmtUsdc, bytesToHex } from "@/lib/format";
import type { Role } from "@/lib/rules";

export function WithdrawDialog({
  open,
  onClose,
  deal,
  role,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  deal: UiDeal;
  role: Role;
  onConfirm: () => void;
  loading: boolean;
}) {
  const asPayer = role === "payer";
  const split = payout(deal, asPayer ? "payerWithdrew" : "payeeWithdrew")!;
  const mine = asPayer ? split.toPayer : split.toPayee;
  const theirs = asPayer ? split.toPayee : split.toPayer;
  const myLocked = asPayer ? deal.payerAmount : deal.payeeStake;
  const loss = myLocked.sub(mine);
  const other = asPayer ? deal.tpl.roles.payee : deal.tpl.roles.payer;

  return (
    <Modal open={open} onClose={onClose} title="Back out of this deal?">
      <p className="text-sm leading-relaxed text-slate-400">
        Backing out settles the deal immediately under the agreed <b className="text-slate-200">{deal.penalty === "forfeit" ? "Forfeit" : "Refund"}</b>{" "}
        rule. This cannot be undone and is recorded as &ldquo;withdrew&rdquo; on your public track record.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">You receive</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-white">{fmtUsdc(mine)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">{other} receives</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-white">{fmtUsdc(theirs)}</div>
        </div>
      </div>
      {loss.gtn(0) ? (
        <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200">
          You lose <b>{fmtUsdc(loss)}</b>{" "}
          {asPayer ? `(your ${deal.tpl.amountLabel} goes to the ${other.toLowerCase()}).` : `(your stake goes to the ${other.toLowerCase()}).`}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
          No penalty under this rule: everyone gets their own money back.
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Keep the deal
        </Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm} loading={loading} data-testid="withdraw-confirm">
          Back out
        </Button>
      </div>
    </Modal>
  );
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Collects evidence (text and/or a file). The file never leaves the browser: only its SHA-256 fingerprint is sent
 * to /api/hash, which adds a random salt. The salted hash goes on-chain.
 */
export function DisputeDialog({
  open,
  onClose,
  deal,
  uploader,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  deal: UiDeal;
  uploader: string | null;
  onSubmit: (hashBytes: number[]) => void;
  loading: boolean;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!text.trim() && !file) {
      setError("Describe the problem or attach a file.");
      return;
    }
    setBusy(true);
    try {
      const fileInfo = file
        ? { name: file.name, size: file.size, type: file.type, sha256: await sha256Hex(await file.arrayBuffer()) }
        : null;
      const res = await fetch("/api/hash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "evidence",
          deal: deal.address.toBase58(),
          uploader,
          data: { deal: deal.address.toBase58(), statement: text.trim() || null, file: fileInfo, at: new Date().toISOString() },
        }),
      });
      if (!res.ok) throw new Error(`Hash service failed (${res.status})`);
      const { hashBytes } = (await res.json()) as { hashBytes: number[] };
      onSubmit(hashBytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Open a dispute">
      <p className="text-sm leading-relaxed text-slate-400">
        The funds freeze and the arbiter you both agreed on decides how to split them (they can never keep any). Your evidence stays off-chain; only a salted
        SHA-256 fingerprint is written to Solana.
      </p>
      <label className="mt-4 block">
        <span className="label">What went wrong?</span>
        <textarea
          className="input mt-2 min-h-[110px] resize-y"
          placeholder="e.g. The car's mileage at the handover was 40,000 km higher than in the listing."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
        />
      </label>
      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3 text-sm text-slate-400 hover:border-white/30">
        {file ? <FileText className="h-5 w-5 text-brand-mint" /> : <Upload className="h-5 w-5" />}
        <span className="min-w-0 flex-1 truncate">{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB (hashed locally)` : "Attach a photo or document (optional)"}</span>
        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="warning" className="flex-1" onClick={submit} loading={busy || loading}>
          Freeze &amp; open dispute
        </Button>
      </div>
    </Modal>
  );
}
