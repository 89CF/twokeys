#!/usr/bin/env python3
"""
Kapora Protocol - pitch deck generator.

One layout model -> two renderers:
  * deck.pptx  (python-pptx)
  * deck.html  -> deck.pdf  (headless Edge/Chrome --print-to-pdf, same coordinates)
  * preview/slide-NN.png  (rendered from deck.pdf with PyMuPDF, for QA / gallery)

Screenshots: drop real images at
  pitch/screens/deal.png    (slide 3, "deal page")
  pitch/screens/widget.png  (slide 8, "DemoAuto listing with widget")
and re-run `python build_deck.py`. If a file is missing, a labelled placeholder is drawn.

Requirements (pip install --user): python-pptx pillow pymupdf
Optional: LibreOffice is NOT required; the PDF is printed by Edge/Chrome from deck.html.
Flags: --no-pdf  (only write pptx + html)
"""
import html
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
from lxml import etree

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
SCREENS = HERE / "screens"
PREVIEW = HERE / "preview"

SW, SH = 13.333, 7.5  # 16:9 in inches
TOTAL = 10

# ---------------------------------------------------------------- palette
BG = "070B18"
CARD = "0F1529"
CARD2 = "141C35"
BORDER = "243055"
TEXT = "F4F6FF"
TEXT2 = "B4BCD6"
MUTED = "6F7A9A"
PURPLE = "9945FF"
VIOLET = "8B5CF6"
TEAL = "14F195"
CYAN = "19D3C5"
RED = "FF5C7A"
AMBER = "FFB547"
NAVY_INK = "0A0F22"
GRAD = (PURPLE, TEAL)

SANS = "Segoe UI"
MONO = "Consolas"
LH = {SANS: 1.33, MONO: 1.17}  # natural line height of the fonts (CSS side)


# ---------------------------------------------------------------- model
class Slide:
    def __init__(self, bg="bg.png", notes=""):
        self.els = []
        self.bg = bg
        self.notes = notes

    def add(self, **kw):
        self.els.append(kw)
        return kw


def R(text, **o):
    """A text run."""
    d = {"text": text}
    d.update(o)
    return d


def P(*runs, **o):
    """A paragraph: runs (str or R) + options (align, space_after, ls)."""
    rr = [R(r) if isinstance(r, str) else r for r in runs]
    d = {"runs": rr}
    d.update(o)
    return d


def rect(s, x, y, w, h, fill=None, line=None, lw=1.0, radius=0.0, grad=None, dash=False, name=None):
    return s.add(kind="rect", x=x, y=y, w=w, h=h, fill=fill, line=line, lw=lw, radius=radius,
                 grad=grad, dash=dash, name=name)


def text(s, x, y, w, h, paras, size=16, color=TEXT, bold=False, italic=False, align="l", valign="t",
         font=SANS, ls=1.0, spacing=0, pre=False, name=None):
    if isinstance(paras, (str, dict)):
        paras = [paras]
    pp = []
    for p in paras:
        if isinstance(p, str):
            p = P(p)
        elif "runs" not in p:
            p = P(p)
        pp.append(p)
    return s.add(kind="text", x=x, y=y, w=w, h=h, paras=pp, size=size, color=color, bold=bold,
                 italic=italic, align=align, valign=valign, font=font, ls=ls, spacing=spacing, pre=pre,
                 name=name)


def line(s, x1, y1, x2, y2, color=BORDER, lw=1.5, arrow=False, dash=False):
    return s.add(kind="line", x1=x1, y1=y1, x2=x2, y2=y2, color=color, lw=lw, arrow=arrow, dash=dash)


def image(s, path, x, y, w, h):
    return s.add(kind="image", path=str(path), x=x, y=y, w=w, h=h)


# ---------------------------------------------------------------- reusable bits
def chrome(s, n, eyebrow, title, subtitle=None):
    text(s, 0.7, 0.48, 9, 0.3, f"{n:02d}  ·  {eyebrow.upper()}", size=11.5, color=TEAL, bold=True, spacing=2.5)
    text(s, 0.7, 0.78, 11.9, 0.75, title, size=34, bold=True, color=TEXT)
    if subtitle:
        text(s, 0.7, 1.5, 11.9, 0.4, subtitle, size=15, color=TEXT2)
    footer(s, n)


def footer(s, n):
    text(s, 0.7, 6.98, 6, 0.25, [P(R("Kapora", bold=True, color=TEXT2), R("  Protocol  ·  HackYeah 2026"))],
         size=10, color=MUTED)
    text(s, 10.63, 6.98, 2.0, 0.25, f"{n:02d} / {TOTAL:02d}", size=10, color=MUTED, align="r")


def card(s, x, y, w, h, fill=CARD, line_=BORDER, radius=0.16, name=None):
    return rect(s, x, y, w, h, fill=fill, line=line_, lw=1.0, radius=radius, name=name)


def num_badge(s, x, y, d, label, grad=GRAD, fill=None, color=NAVY_INK, size=15):
    rect(s, x, y, d, d, fill=fill, grad=None if fill else grad, radius=d / 2)
    text(s, x, y, d, d, label, size=size, bold=True, color=color, align="c", valign="m")


def pill(s, x, y, w, h, label, fill=None, line_=None, color=TEXT, size=11, bold=True, grad=None, spacing=1.0):
    rect(s, x, y, w, h, fill=fill, line=line_, lw=1.0, radius=h / 2, grad=grad)
    text(s, x, y, w, h, label, size=size, bold=bold, color=color, align="c", valign="m", spacing=spacing)


def screenshot_slot(s, x, y, w, h, filename, label, caption=None):
    path = SCREENS / filename
    if path.exists():
        rect(s, x, y, w, h, fill="0B1022", line=BORDER, lw=1.0, radius=0.12)
        pad = 0.08
        bx, by, bw, bh = x + pad, y + pad, w - 2 * pad, h - 2 * pad
        with Image.open(path) as im:
            iw, ih = im.size
        scale = min(bw / iw, bh / ih)
        dw, dh = iw * scale, ih * scale
        image(s, path, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh)
    else:
        rect(s, x, y, w, h, fill="0C1226", line="3A4A78", lw=1.5, radius=0.18, dash=True,
             name=f"PLACEHOLDER {label}")
        text(s, x, y + h / 2 - 0.45, w, 0.4, label, size=16, bold=True, color=TEXT2, align="c", valign="m")
        text(s, x, y + h / 2 + 0.02, w, 0.35, f"drop  pitch/screens/{filename}  and re-run build_deck.py",
             size=11, color=MUTED, align="c", valign="m", font=MONO)
    if caption:
        text(s, x, y + h + 0.12, w, 0.3, caption, size=11.5, color=MUTED, align="c")


# ---------------------------------------------------------------- slides
def build_slides():
    slides = []

    # 1 ── Title ------------------------------------------------------------
    s = Slide(bg="bg_title.png", notes=(
        "Hi, I'm [Name]. This is Kapora: trustless deposits for marketplaces, built as one trust component that "
        "any marketplace, in any sector, can plug in. Our one-liner: you can disappear, but not with my money."))
    rect(s, 0.85, 1.05, 0.62, 0.62, grad=GRAD, radius=0.16)
    text(s, 0.85, 1.05, 0.62, 0.62, "K", size=24, bold=True, color=NAVY_INK, align="c", valign="m")
    text(s, 1.62, 1.18, 6, 0.4, "KAPORA PROTOCOL", size=13, bold=True, color=TEXT2, spacing=3, valign="m")
    text(s, 0.75, 1.72, 7.0, 1.85, [P(R("Kapora", grad=GRAD))], size=100, bold=True)
    text(s, 0.85, 3.72, 7.3, 0.6, "Trustless deposits for marketplaces", size=30, color=TEXT)
    text(s, 0.85, 4.42, 7.3, 0.45, "One trust component for every marketplace and sector.", size=18, color=TEAL)
    text(s, 0.85, 5.0, 7.3, 0.45, "“You can disappear — but not with my money.”", size=18,
         italic=True, color=TEXT2)
    text(s, 0.85, 6.3, 8.0, 0.35, "HackYeah 2026  ·  Superteam PL  ·  Finance Without Intermediaries",
         size=13.5, color=MUTED)
    for i, (who, sym, sub) in enumerate([("Buyer deposit", "D", "locked on reserve"),
                                         ("Seller stake", "S", "locked first")]):
        x = 8.35 + i * 2.25
        card(s, x, 1.25, 2.05, 1.45, fill=CARD2)
        text(s, x + 0.22, 1.42, 1.7, 0.3, who.upper(), size=10, bold=True, color=MUTED, spacing=1.5)
        text(s, x + 0.22, 1.72, 1.7, 0.5, [P(R(sym, color=TEAL if i == 0 else VIOLET), R(" = 2,000"))],
             size=24, bold=True)
        text(s, x + 0.22, 2.25, 1.7, 0.3, sub, size=11, color=TEXT2)
        line(s, x + 1.025, 2.75, x + 1.025, 3.33, color=VIOLET if i else TEAL, lw=2, arrow=True)
    rect(s, 8.35, 3.4, 4.3, 1.75, grad=GRAD, radius=0.18)
    rect(s, 8.38, 3.43, 4.24, 1.69, fill="0D1330", radius=0.16)
    text(s, 8.6, 3.6, 3.9, 0.3, "PROGRAM-OWNED VAULT", size=10, bold=True, color=MUTED, spacing=1.5)
    text(s, 8.6, 3.9, 3.9, 0.6, [P(R("P = 4,000", grad=GRAD))], size=30, bold=True)
    text(s, 8.6, 4.55, 3.9, 0.35, "No one in the middle can touch it", size=12.5, color=TEXT2)
    text(s, 8.35, 5.38, 4.3, 0.35, "No court, no escrow agent — just the rule", size=13,
         color=TEXT, align="c")
    pill(s, 9.35, 5.9, 2.3, 0.4, "●  LIVE ON SOLANA DEVNET", fill="0E2A2A", line_=TEAL, color=TEAL,
         size=9.5)
    slides.append(s)

    # 2 ── Problem ------------------------------------------------------------
    s = Slide(notes=(
        "On car, real-estate and second-hand marketplaces the scam is always the same: a listing that looks too "
        "good, a deposit by bank transfer, and the seller vanishes. Polish law already has the answer, "
        "art. 394 zadatek, but nobody sues a stranger over a few thousand zloty."))
    chrome(s, 2, "The problem", "A deposit to a stranger is a leap of faith",
           "Car, real-estate and second-hand marketplaces share one weak spot: the up-front deposit.")
    steps = [
        ("A listing that looks too good", "Car, flat or rental at a great price. The “seller” asks "
                                          "for a deposit to hold it."),
        ("Paid by bank transfer", "Straight to a stranger’s IBAN. No vault, no conditions, no undo."),
        ("Then the seller disappears", "Listing deleted, phone offline. No history to check, nobody "
                                       "to chase."),
    ]
    for i, (h_, b_) in enumerate(steps):
        x = 0.7 + i * 4.13
        card(s, x, 2.15, 3.75, 2.0)
        num_badge(s, x + 0.3, 2.42, 0.5, str(i + 1), fill="3A1426", color=RED, size=14)
        text(s, x + 0.3, 3.05, 3.2, 0.4, h_, size=17, bold=True)
        text(s, x + 0.3, 3.45, 3.2, 0.65, b_, size=13.5, color=TEXT2)
    card(s, 0.7, 4.45, 11.98, 2.2, fill="11122C", line_="3B2D6E")
    text(s, 1.05, 4.7, 3.0, 0.3, "POLISH CIVIL CODE", size=10.5, bold=True, color=MUTED, spacing=1.5)
    text(s, 1.0, 4.98, 3.0, 0.85, [P(R("Art. 394", grad=GRAD))], size=44, bold=True)
    text(s, 1.05, 5.85, 3.0, 0.4, "“zadatek” (earnest money)", size=14, italic=True, color=TEXT2)
    text(s, 4.35, 4.75, 8.0, 1.0, [
        P(R("Buyer backs out  →  ", color=TEXT2), R("seller keeps the deposit.", bold=True),
          space_after=6),
        P(R("Seller backs out  →  ", color=TEXT2), R("buyer gets double back.", bold=True)),
    ], size=17)
    text(s, 4.35, 5.62, 8.0, 0.8, [
        P("The law already says who pays.", space_after=2),
        P(R("But nobody sues a stranger over a few thousand złoty.", color=TEAL, bold=True))],
         size=15, color=TEXT)
    slides.append(s)

    # 3 ── Target user & design rationale ------------------------------------------------
    s = Slide(notes=(
        "Who is this for? Primarily people in Poland who find a car or a flat on a listing site and pay a zadatek "
        "to a stranger, and their sellers. They are not crypto users, so the interface talks about accounts and "
        "PLN. Secondary users are marketplaces that embed our widget. The relationship we redesigned is the "
        "up-front deposit. Today the intermediary is either nobody, just an IBAN transfer, or an expensive one: a "
        "court, a notary escrow or paid platform protection. Without it, the legal rule runs instantly."))
    chrome(s, 3, "Target user & design rationale", "Who it’s for — and what we redesigned")
    card(s, 0.7, 1.75, 4.65, 4.95, fill="0D1A26", line_="1B5B54")
    text(s, 1.0, 1.98, 4.1, 0.3, "PRIMARY USER", size=10.5, bold=True, color=TEAL, spacing=2)
    text(s, 1.0, 2.32, 4.1, 1.6, "People in Poland paying a zadatek to strangers from listing sites — "
                                 "and their sellers.", size=18, bold=True, color=TEXT)
    text(s, 1.0, 3.75, 4.1, 0.9, "Not crypto users. The app says “account”, shows amounts in PLN "
                                 "and hides the chain.", size=13, color=TEXT2)
    line(s, 1.0, 4.85, 5.05, 4.85, color="1B5B54", lw=1)
    text(s, 1.0, 5.05, 4.1, 0.3, "SECONDARY USER", size=10.5, bold=True, color=VIOLET, spacing=2)
    text(s, 1.0, 5.4, 4.1, 1.1, "Marketplaces that embed the widget — our distribution channel.",
         size=14.5, color=TEXT)
    rows = [
        ("Which relationship?", "An up-front deposit paid to a stranger before the deal is completed."),
        ("Who was the intermediary?", "Usually nobody — an IBAN transfer straight to the stranger. Or costly "
                                      "ones: a court to enforce art. 394, a notary escrow, a platform’s paid "
                                      "payment protection."),
        ("What changes without it?", "The rule runs instantly, with no court: whoever backs out loses; a seller who "
                                     "walks pays 2×. Money waits in the program, not with either side. No fee, "
                                     "and nobody can block the payout."),
    ]
    for i, (h_, b_) in enumerate(rows):
        y = 1.75 + i * 1.69
        card(s, 5.65, y, 7.03, 1.55)
        num_badge(s, 5.92, y + 0.22, 0.46, str(i + 1), size=13)
        text(s, 6.6, y + 0.18, 5.85, 0.4, h_, size=16, bold=True)
        text(s, 6.6, y + 0.58, 5.85, 0.9, b_, size=13, color=TEXT2)
    slides.append(s)

    # 4 ── Solution -----------------------------------------------------------
    s = Slide(notes=(
        "Kapora is the law as code. The seller locks a stake first, so a fake seller has to risk their own money. "
        "The buyer locks the deposit into a vault owned by the program. Two confirmations at the handover release "
        "the money. If someone backs out or vanishes, the legal rule pays out automatically."))
    chrome(s, 4, "The solution", "The law, as code",
           "The deposit rule becomes a Solana program. Nobody in the middle holds the money.")
    sol = [
        ("Seller locks a stake  S  first", "Equal to D — a fake seller must risk their own money."),
        ("Buyer locks the deposit  D", "Into a program-owned vault — never the seller’s account."),
        ("Both confirm the handover", "Two confirmations release P = D + S to the seller."),
        ("Someone backs out or vanishes?", "The rule pays out: if the seller walks, the buyer gets 2×."),
    ]
    for i, (h_, b_) in enumerate(sol):
        y = 2.2 + i * 1.12
        num_badge(s, 0.7, y + 0.04, 0.56, str(i + 1))
        text(s, 1.5, y, 4.95, 0.4, h_, size=17.5, bold=True)
        text(s, 1.5, y + 0.42, 4.95, 0.5, b_, size=13.5, color=TEXT2)
    screenshot_slot(s, 6.75, 2.1, 5.93, 4.15, "deal.png", "SCREENSHOT: deal page",
                    "/d/<deal> after the deadline: even a visitor can press “Apply the outcome”")
    slides.append(s)

    # 5 ── Where the intermediary disappears -------------------------------------------
    s = Slide(notes=(
        "Where exactly does the intermediary disappear? In settle.rs: payout computes the split from the rule, and "
        "settle moves the money out of the vault PDA. It is called by confirm_complete, withdraw and "
        "claim_after_deadline. The vault has no private key; funds leave only through settle. And here is the "
        "moment the intermediary is no longer needed: if the seller vanishes, after the deadline anyone can call "
        "claim_after_deadline and the program pays out by the rule. There is no admin instruction, and the upgrade "
        "authority will be revoked after the final deploy."))
    chrome(s, 5, "Relevance", "Where the intermediary disappears",
           "Every rule that moves money lives in the on-chain program. The app and widget cannot move funds.")
    chips = [("confirm_complete()", "payer + payee", False), ("withdraw()", "payer or payee", False),
             ("claim_after_deadline()", "ANYONE, after deadline", True)]
    for i, (fn, who, hi) in enumerate(chips):
        x = 0.7 + i * 2.16
        rect(s, x, 2.1, 2.0, 0.82, fill="0E2A26" if hi else CARD2, line=TEAL if hi else BORDER,
             lw=1.25 if hi else 1.0, radius=0.1)
        text(s, x, 2.2, 2.0, 0.3, fn, size=11, bold=True, font=MONO, color=TEAL if hi else TEXT, align="c")
        text(s, x, 2.53, 2.0, 0.28, who, size=10.5, bold=hi, color=TEAL if hi else TEXT2, align="c")
        line(s, x + 1.0, 2.94, x + 1.0, 3.3, color=TEAL if hi else VIOLET, lw=1.75, arrow=True)
    rect(s, 0.7, 3.32, 6.32, 1.72, fill="060914", line="3F2F7A", lw=1.25, radius=0.12)
    text(s, 0.95, 3.45, 5.9, 0.3, "programs/kapora/src/settle.rs", size=11.5, font=MONO, color=VIOLET, bold=True)
    text(s, 0.95, 3.8, 5.9, 0.3, [P(R("payout", color=TEAL, bold=True),
                                    R("(penalty, on_complete, outcome, D, S, bps)", color=TEXT))],
         size=12, font=MONO)
    text(s, 0.95, 4.08, 5.9, 0.3, "  → (to_payer, to_payee)", size=12, font=MONO, color=TEXT2)
    text(s, 0.95, 4.42, 5.9, 0.55, [P(R("settle", color=TEAL, bold=True, font=MONO),
                                     R("()  checks to_payer + to_payee == P, pays out from the vault by PDA "
                                       "signature, updates Profile + PlatformStats", color=TEXT2))], size=11.5)
    line(s, 3.86, 5.06, 3.86, 5.4, color=VIOLET, lw=1.75, arrow=True)
    rect(s, 0.7, 5.42, 6.32, 1.08, grad=GRAD, radius=0.12)
    rect(s, 0.73, 5.45, 6.26, 1.02, fill="0D1330", radius=0.1)
    text(s, 0.95, 5.55, 5.9, 0.35, [P(R("Vault PDA  ", bold=True, color=TEXT),
                                     R("[\"vault\", deal]", font=MONO, color=TEAL))], size=14)
    text(s, 0.95, 5.93, 5.9, 0.45, "authority = the Deal PDA · no private key · funds leave only "
                                  "through settle()", size=12, color=TEXT2)
    # right column
    rect(s, 7.35, 2.1, 5.33, 2.05, grad=GRAD, radius=0.16)
    rect(s, 7.38, 2.13, 5.27, 1.99, fill="0E1A2E", radius=0.14)
    text(s, 7.62, 2.28, 4.9, 0.3, "THE MOMENT THE INTERMEDIARY IS NO LONGER NEEDED", size=9.5, bold=True,
         color=TEAL, spacing=1)
    text(s, 7.62, 2.65, 4.85, 1.4, [
        P(R("Seller vanished? ", bold=True, color=TEXT),
          R("After the deadline, ", color=TEXT2), R("anyone", bold=True, color=TEAL),
          R(" can press “Apply the outcome” (claim_after_deadline). The program counts the missing party as a "
            "no-show and pays out by the rule. No court, no support ticket, no admin.", color=TEXT2))], size=13.5)
    card(s, 7.35, 4.35, 5.33, 2.32)
    text(s, 7.62, 4.47, 4.9, 0.3, "WHO CAN CALL WHAT", size=10, bold=True, color=MUTED, spacing=1.5)
    perms = [("create_offer", "payee"), ("reserve", "payer"),
             ("confirm_complete · withdraw · open_dispute", "payer or payee"),
             ("resolve", "arbiter, only if agreed"), ("claim_after_deadline · expire_dispute", "anyone"),
             ("cancel_offer", "payee; anyone after window")]
    for i, (fn, who) in enumerate(perms):
        y = 4.76 + i * 0.245
        text(s, 7.62, y, 3.6, 0.25, fn, size=10, font=MONO, color=TEXT, valign="m")
        text(s, 10.6, y, 1.85, 0.25, who, size=10, color=TEAL if who == "anyone" else TEXT2, align="r",
             valign="m", bold=who == "anyone")
    text(s, 7.62, 6.32, 4.9, 0.3, [P(R("No admin instruction. ", bold=True, color=TEXT),
                                    R("Upgrade authority will be revoked after final deploy.", color=TEXT2))],
         size=10.5)
    slides.append(s)

    # 6 ── Rules: templates + payout table ---------------------------------------------
    s = Slide(notes=(
        "One payout table drives everything. Two parameters: penalty, Forfeit or Refund, and on_complete, whether "
        "the payer's amount goes to the payee or back to the payer. The four templates are just presets of the same "
        "program. Deposit is our main story: Forfeit, to the payee, stake equals deposit, labelled zadatek. If the "
        "payee backs out under Forfeit, the payer receives P, which for a zadatek is twice the deposit."))
    chrome(s, 6, "The rule engine", "Same program, four templates, one payout table")
    tpls = [("Deposit · zadatek", "buyer / seller", "Forfeit · ToPayee · S=D", True),
            ("Rental", "renter / owner", "Forfeit · ToPayer · S=0", False),
            ("Freelance", "client / freelancer", "Forfeit · ToPayee · S=0", False),
            ("Purchase", "buyer / seller", "Forfeit · ToPayee · S=0", False)]
    for i, (nm, roles, params, main) in enumerate(tpls):
        x = 0.7 + i * 3.03
        card(s, x, 1.62, 2.89, 1.05, fill="16163A" if main else CARD, line_=VIOLET if main else BORDER,
             radius=0.12)
        text(s, x + 0.2, 1.7, 2.5, 0.32, nm, size=13.5, bold=True, valign="m")
        text(s, x + 0.2, 2.02, 2.5, 0.25, f"payer / payee = {roles}", size=10, color=TEXT2)
        text(s, x + 0.2, 2.3, 2.5, 0.25, params, size=10, font=MONO, color=TEAL if main else TEXT)
    cols = [("Outcome", 2.95), ("When", 3.55), ("Forfeit", 2.74), ("Refund", 2.74)]
    TX, TY, HH, RH = 0.7, 2.85, 0.56, 0.43
    xs = []
    cx = TX
    for _, w in cols:
        xs.append(cx)
        cx += w
    TW = cx - TX
    rect(s, TX, TY, TW, HH + 7 * RH + 0.04, fill=CARD, line=BORDER, lw=1.0, radius=0.12)
    for i, (nm, w) in enumerate(cols):
        x = xs[i]
        if i >= 2:
            rect(s, x + 0.06, TY + 0.05, w - 0.12, HH - 0.1, fill="1B1F4A" if i == 2 else "152238", radius=0.08)
            text(s, x, TY + 0.06, w, 0.27, nm, size=12, bold=True, align="c", color=TEXT)
            text(s, x, TY + 0.31, w, 0.22, "to payer  /  to payee", size=9.5, color=MUTED, align="c")
        else:
            text(s, x + 0.25, TY, w - 0.3, HH, nm.upper(), size=10, bold=True, color=MUTED, valign="m",
                 spacing=1.5)
    table = [
        ("Completed", "Both confirmed (ToPayee · ToPayer)", "0 / P  ·  D / S", "0 / P  ·  D / S"),
        ("PayerWithdrew / NoShow", "Payer backed out, or only payee confirmed", "0 / P", "D / S"),
        ("PayeeWithdrew / NoShow", "Payee backed out, or only payer confirmed", "P / 0", "D / S"),
        ("Expired", "Deadline passed, nobody confirmed", "D / S", "D / S"),
        ("Resolved", "Optional arbiter splits by payer_bps", "bps split", "bps split"),
        ("DisputeTimeout", "Arbiter missed the deadline", "D / S", "D / S"),
        ("Cancelled", "No payer reserved the offer", "— / S", "— / S"),
    ]
    for r, (o, wn, z, zl) in enumerate(table):
        y = TY + HH + r * RH
        line(s, TX + 0.15, y, TX + TW - 0.15, y, color="1E2846", lw=0.75)
        text(s, xs[0] + 0.25, y, cols[0][1] - 0.3, RH, o, size=12.5, bold=True, valign="m")
        text(s, xs[1], y, cols[1][1] - 0.15, RH, wn, size=11, color=TEXT2, valign="m")
        if r == 2:
            rect(s, xs[2] + 0.12, y + 0.05, cols[2][1] - 0.24, RH - 0.1, grad=GRAD, radius=0.08)
            text(s, xs[2], y, cols[2][1], RH, [P(R("P / 0", bold=True), R("   2× for zadatek", size=10.5,
                                                                            bold=True))],
                 size=13.5, color=NAVY_INK, align="c", valign="m")
        else:
            text(s, xs[2], y, cols[2][1], RH, z, size=13.5, bold=True, align="c", valign="m", font=MONO,
                 color=TEXT2 if z == "D / S" else TEXT)
        text(s, xs[3], y, cols[3][1], RH, zl, size=13.5, bold=True, align="c", valign="m", font=MONO,
             color=TEXT2 if zl == "D / S" else TEXT)
    text(s, TX, 6.55, TW, 0.3, [
        P(R("D", bold=True, color=TEAL), " = payer amount · ", R("S", bold=True, color=VIOLET),
          " = payee stake · ", R("P", bold=True), " = D + S · payouts always sum to P · "
          "label Zadatek enforces Forfeit + ToPayee + S = D; Zaliczka enforces Refund")],
         size=10.5, color=TEXT2)
    slides.append(s)

    # 7 ── Integration ------------------------------------------------------------------
    s = Slide(notes=(
        "Integration is one script tag. A marketplace adds the widget to a listing page with a template, and the "
        "button opens the Kapora deal flow. Developers can use the TypeScript SDK instead, and every deal has a "
        "shareable link. Our two demo marketplaces, DemoAuto for cars and DemoRent for equipment rental, are "
        "fictional, and they run the same widget on the same program."))
    chrome(s, 7, "Implementation potential", "One component. Every marketplace, every sector.")
    text(s, 0.7, 1.75, 6, 0.35, [P(R("1  ", color=TEAL), "Drop-in widget")], size=16, bold=True)
    rect(s, 0.7, 2.18, 6.15, 1.5, fill="060914", line=BORDER, radius=0.12)
    TAG, ATT, VAL, PUN = "C792EA", "14F195", "F4D58D", "8A93B2"

    def code_line(parts):
        return P(*[R(t, color=c) for t, c in parts])
    code = [
        code_line([("<", PUN), ("script ", TAG), ("src", ATT), ("=", PUN), ("\"https://<app>/widget.js\"", VAL)]),
        code_line([("        data-platform", ATT), ("=", PUN), ("\"<PLATFORM_PUBKEY>\"", VAL)]),
        code_line([("        data-listing-id", ATT), ("=", PUN), ("\"abc123\"", VAL)]),
        code_line([("        data-amount", ATT), ("=", PUN), ("\"2000\"", VAL)]),
        code_line([("        data-template", ATT), ("=", PUN), ("\"deposit\"", VAL), ("></", PUN),
                   ("script", TAG), (">", PUN)]),
    ]
    text(s, 0.95, 2.36, 5.8, 1.3, code, size=12.5, font=MONO, pre=True)
    text(s, 0.7, 3.78, 6.15, 0.3, [P(R("data-template", font=MONO, color=TEAL),
                                    R("  =  deposit | rental | freelance | purchase", font=MONO, color=TEXT2))],
         size=11)
    text(s, 0.7, 4.25, 6, 0.35, [P(R("2  ", color=TEAL), "TypeScript SDK")], size=16, bold=True)
    fns = ["createOffer()", "reserve()", "confirm()", "withdraw()", "claimAfterDeadline()", "getProfile()"]
    for i, f in enumerate(fns):
        x = 0.7 + (i % 3) * 2.08
        y = 4.68 + (i // 3) * 0.46
        rect(s, x, y, 1.95, 0.37, fill=CARD2, line=BORDER, radius=0.08)
        text(s, x, y, 1.95, 0.37, f, size=11, font=MONO, color=TEXT, align="c", valign="m")
    text(s, 0.7, 5.75, 6, 0.35, [P(R("3  ", color=TEAL), "Shareable deal link")], size=16, bold=True)
    text(s, 0.7, 6.13, 6.2, 0.5, [P(R("/d/<deal>", font=MONO, color=TEAL, bold=True),
                                   R("  —  send it on WhatsApp; both sides see the same live page.",
                                     color=TEXT2))], size=13.5)
    screenshot_slot(s, 7.2, 1.8, 5.48, 3.85, "widget.png", "SCREENSHOT: DemoAuto listing with widget")
    pill(s, 7.2, 5.88, 2.6, 0.4, "DemoAuto  ·  cars  ·  deposit", fill=CARD2, line_=BORDER, color=TEXT,
         size=11, bold=False, spacing=0)
    pill(s, 9.95, 5.88, 2.73, 0.4, "DemoRent  ·  cameras  ·  rental", fill=CARD2, line_=BORDER,
         color=TEXT, size=11, bold=False, spacing=0)
    text(s, 7.2, 6.38, 5.48, 0.3, "Fictional demo marketplaces — same widget, same program", size=10.5,
         color=MUTED, italic=True, align="c")
    slides.append(s)

    # 8 ── Privacy & behaviour trail -----------------------------------------------------
    s = Slide(notes=(
        "Privacy by design. On-chain we keep only money and behaviour: amounts, wallets, deadlines, the rule, "
        "status, salted hashes and behaviour counters, so you can see how a wallet behaved without knowing who it "
        "is. Everything personal lives off-chain and can be deleted; delete the salt and the hash points to "
        "nothing. And nothing off-chain can move money or change an outcome."))
    chrome(s, 8, "Privacy by design", "Money on-chain. People off-chain.",
           "GDPR-friendly by construction: reputation without identity.")
    on = ["Amounts, deadlines, rule parameters, status", "Pseudonymous wallet addresses",
          "Salted SHA-256 hashes of listing & evidence", "Behaviour counters per wallet  (Profile)",
          "Anonymous platform aggregates  (PlatformStats)"]
    off = ["Names, emails, phone numbers", "Listing details, photos, evidence files",
           "Hash salts — delete one, the hash points to nothing", "Wallet ↔ person link",
           "Off-chain data can’t move money or outcomes"]
    for ci, (ttl, sub, items, col, fill, ln) in enumerate([
        ("ON-CHAIN", "Solana · public · permanent", on, TEAL, "0D1A26", "1B5B54"),
        ("OFF-CHAIN", "app server · private · deletable", off, VIOLET, "141333", "3F2F7A")]):
        x = 0.7 + ci * 6.13
        card(s, x, 2.1, 5.85, 3.7, fill=fill, line_=ln)
        text(s, x + 0.35, 2.3, 2.5, 0.4, ttl, size=15, bold=True, color=col, spacing=2, valign="m")
        text(s, x + 2.2, 2.3, 3.35, 0.4, sub, size=11.5, color=TEXT2, align="r", valign="m")
        for i, it in enumerate(items):
            y = 2.92 + i * 0.56
            rect(s, x + 0.38, y + 0.13, 0.16, 0.16, fill=col, radius=0.08)
            text(s, x + 0.72, y, 4.98, 0.42, it, size=13.5, color=TEXT, valign="m",
                 bold=(ci == 1 and i == 4))
    rect(s, 0.7, 6.02, 11.98, 0.62, fill="2A1020", line="6B2440", lw=1.0, radius=0.31)
    text(s, 0.7, 6.02, 11.98, 0.62, [P(R("Never on-chain:  ", bold=True, color=RED),
                                       R("names · emails · phones · addresses · plates "
                                         "· listing text · free text"))],
         size=14, color=TEXT, align="c", valign="m")
    slides.append(s)

    # 9 ── Vision ------------------------------------------------------------------------
    s = Slide(notes=(
        "Where this goes: one trust component that any site in any sector can plug in, like a payment provider but "
        "without the intermediary. Today: one program and one widget with four templates. Next: auto-confirmed "
        "shipped purchases, milestone payments, asset swaps, event-based payouts via oracles, and a payment API. "
        "Betting and prediction markets are deliberately out of scope."))
    chrome(s, 9, "Vision", "Deposits are step one",
           "A trust layer any website can plug in — the same Deal account; a new kind only for new mechanics.")
    stages = [("One program + widget", "4 templates: deposit, rental, freelance, purchase. Nothing extra.", True),
              ("Auto-confirmed shipping", "Adds a shipping-data attester and an inspection window.", False),
              ("Milestone payments", "Adds a sequence of stages (kind: Milestones).", False),
              ("Digital asset swaps", "Adds nothing: asset and payment swap in one transaction.", False),
              ("Event-based payouts", "e.g. parametric flight-delay insurance. Adds an oracle.", False),
              ("Payment API for any site", "Adds dashboard, webhooks and a fee model.", False)]
    GAP = 0.15
    CW = (11.98 - 5 * GAP) / 6
    line(s, 0.7 + CW / 2, 2.55, 0.7 + 5 * (CW + GAP) + CW / 2, 2.55, color="34406A", lw=2, dash=True)
    for i, (ttl, add, live) in enumerate(stages):
        x = 0.7 + i * (CW + GAP)
        cxm = x + CW / 2
        if live:
            num_badge(s, cxm - 0.3, 2.25, 0.6, "1", size=17)
        else:
            rect(s, cxm - 0.3, 2.25, 0.6, 0.6, fill=BG, line="4A5888", lw=1.5, radius=0.3)
            text(s, cxm - 0.3, 2.25, 0.6, 0.6, str(i + 1), size=17, bold=True, color=TEXT2, align="c", valign="m")
        card(s, x, 3.15, CW, 2.6, fill="16163A" if live else CARD, line_=VIOLET if live else BORDER)
        if live:
            pill(s, x + 0.16, 3.33, CW - 0.32, 0.3, "LIVE ON DEVNET", grad=GRAD, color=NAVY_INK, size=8.5)
        else:
            text(s, x + 0.16, 3.33, CW - 0.32, 0.3, "NEXT" if i == 1 else "LATER", size=9, bold=True,
                 color=MUTED, spacing=1.5, valign="m")
        text(s, x + 0.16, 3.78, CW - 0.3, 0.75, ttl, size=14, bold=True, color=TEXT)
        text(s, x + 0.16, 4.55, CW - 0.3, 1.15, add, size=11, color=TEXT2)
    rect(s, 0.7, 5.98, 11.98, 0.68, fill="060914", line=BORDER, radius=0.12)
    text(s, 0.95, 5.98, 11.5, 0.68, [
        P(R("Deliberately out of scope: ", bold=True, color=TEXT), R("betting / prediction markets.   ",
                                                                      color=TEXT2),
          R("Vision only, not in the MVP: ", bold=True, color=TEXT),
          R("encrypted identity escrow for large deals (an off-chain trust feature).", color=TEXT2))],
         size=11.5, valign="m")
    slides.append(s)

    # 10 ── Closing ------------------------------------------------------------------
    s = Slide(bg="bg_title.png", notes=(
        "One component: every marketplace, every sector, every country. Built on Solana with Anchor, SPL Token, "
        "Next.js and a TypeScript SDK. And honestly: confirmations of the real-world handover come from the "
        "parties, an arbiter is trusted once both agree to one, and this is devnet with test USDC. Repo, video "
        "and live demo are linked here. Thank you."))
    rect(s, 0.85, 1.0, 0.62, 0.62, grad=GRAD, radius=0.16)
    text(s, 0.85, 1.0, 0.62, 0.62, "K", size=24, bold=True, color=NAVY_INK, align="c", valign="m")
    text(s, 0.82, 1.8, 11.8, 0.8, "One component —", size=42, bold=True, color=TEXT)
    text(s, 0.82, 2.55, 11.8, 0.8, [P(R("every marketplace, every sector,", grad=GRAD))], size=42, bold=True)
    text(s, 0.82, 3.3, 11.8, 0.8, [P(R("every country.", grad=GRAD))], size=42, bold=True)
    stack = ["Solana", "Anchor 0.32", "SPL Token", "Next.js", "TypeScript SDK"]
    x = 0.85
    for st in stack:
        w = 0.42 + 0.098 * len(st)
        pill(s, x, 4.35, w, 0.4, st, fill=CARD2, line_=BORDER, color=TEXT, size=12, bold=False, spacing=0)
        x += w + 0.16
    info = [("Repo", "[ github.com/<user>/kapora ]"), ("Video", "[ public video link, ≤ 3 min ]"),
            ("Live demo", "[ https://<demo-url> ]  ·  devnet, Phantom"),
            ("Program", "AkQXPVXUYDqyNUVNAsYGYXy9sHQR636xcuJbAJkiJe5F"),
            ("Team", "[Team name]  ·  [Name Surname]  ·  ahmetenes2004@hotmail.com")]
    card(s, 0.85, 4.98, 7.45, 1.8, fill="0D1330")
    for i, (k, v) in enumerate(info):
        y = 5.08 + i * 0.32
        text(s, 1.08, y, 1.3, 0.3, k.upper(), size=9.5, bold=True, color=MUTED, spacing=1.5, valign="m")
        text(s, 2.3, y, 5.9, 0.3, v, size=12 if i != 3 else 11.5, color=TEXT if i != 3 else TEAL,
             font=MONO if i == 3 else SANS, valign="m")
    card(s, 8.6, 4.35, 4.08, 2.43, fill="0B1022")
    text(s, 8.85, 4.5, 3.6, 0.3, "LIMITATIONS (HONEST)", size=9.5, bold=True, color=AMBER, spacing=1.5)
    lims = ["The handover is off-chain: confirmations come from the parties.",
            "An arbiter is optional — and trusted once both agree to one.",
            "Devnet and test USDC only; not audited, not production-ready.",
            "Legal effect of an on-chain zadatek needs legal review."]
    for i, l_ in enumerate(lims):
        y = 4.85 + i * 0.47
        rect(s, 8.87, y + 0.09, 0.09, 0.09, fill=AMBER, radius=0.045)
        text(s, 9.08, y, 3.45, 0.45, l_, size=10.5, color=TEXT2)
    slides.append(s)
    return slides


# ---------------------------------------------------------------- assets
def make_backgrounds():
    ASSETS.mkdir(exist_ok=True)
    W, H = 1920, 1080

    def glow(img, cx, cy, r, rgb, alpha):
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgb + (alpha,))
        layer = layer.filter(ImageFilter.GaussianBlur(r * 0.55))
        return Image.alpha_composite(img, layer)

    base = (7, 11, 24, 255)
    img = Image.new("RGBA", (W, H), base)
    img = glow(img, 1780, -80, 520, (153, 69, 255), 70)
    img = glow(img, 60, 1160, 460, (20, 241, 149), 34)
    img.convert("RGB").save(ASSETS / "bg.png")

    img = Image.new("RGBA", (W, H), base)
    img = glow(img, 1650, 120, 700, (153, 69, 255), 115)
    img = glow(img, 1500, 1100, 520, (20, 241, 149), 60)
    img = glow(img, -100, -100, 420, (99, 102, 241), 50)
    img.convert("RGB").save(ASSETS / "bg_title.png")


# ---------------------------------------------------------------- PPTX renderer
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"


def _rgb(h):
    return RGBColor.from_string(h)


def _grad_xml(stops, ang=0):
    gs = "".join(f'<a:gs pos="{int(p)}"><a:srgbClr val="{c}"/></a:gs>' for p, c in stops)
    return etree.fromstring(
        f'<a:gradFill xmlns:a="{A_NS}" rotWithShape="1"><a:gsLst>{gs}</a:gsLst>'
        f'<a:lin ang="{int(ang * 60000)}" scaled="0"/></a:gradFill>')


def _strip_style(shape):
    st = shape._element.find(qn("p:style"))
    if st is not None:
        shape._element.remove(st)


def render_pptx(slides, out):
    prs = Presentation()
    prs.slide_width = Inches(SW)
    prs.slide_height = Inches(SH)
    blank = prs.slide_layouts[6]
    for sd in slides:
        sl = prs.slides.add_slide(blank)
        bgp = sl.shapes.add_picture(str(ASSETS / sd.bg), 0, 0, prs.slide_width, prs.slide_height)
        bgp.name = "Background"
        for e in sd.els:
            k = e["kind"]
            if k == "rect":
                shp = sl.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if e["radius"] else MSO_SHAPE.RECTANGLE,
                                          Inches(e["x"]), Inches(e["y"]), Inches(e["w"]), Inches(e["h"]))
                _strip_style(shp)
                if e["radius"]:
                    shp.adjustments[0] = min(0.5, e["radius"] / min(e["w"], e["h"]))
                if e["grad"]:
                    spPr = shp._element.spPr
                    g = _grad_xml([(0, e["grad"][0]), (100000, e["grad"][1])], 0)
                    geom = spPr.find(qn("a:prstGeom"))
                    geom.addnext(g)
                elif e["fill"]:
                    shp.fill.solid()
                    shp.fill.fore_color.rgb = _rgb(e["fill"])
                else:
                    shp.fill.background()
                if e["line"]:
                    shp.line.color.rgb = _rgb(e["line"])
                    shp.line.width = Pt(e["lw"])
                    if e["dash"]:
                        shp.line.dash_style = MSO_LINE.DASH
                else:
                    shp.line.fill.background()
                if e["name"]:
                    shp.name = e["name"]
            elif k == "line":
                c = sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(e["x1"]), Inches(e["y1"]),
                                            Inches(e["x2"]), Inches(e["y2"]))
                _strip_style(c)
                c.line.color.rgb = _rgb(e["color"])
                c.line.width = Pt(e["lw"])
                if e["dash"]:
                    c.line.dash_style = MSO_LINE.DASH
                if e["arrow"]:
                    ln = c.line._get_or_add_ln()
                    te = etree.SubElement(ln, qn("a:tailEnd"))
                    te.set("type", "triangle")
                    te.set("w", "med")
                    te.set("len", "med")
            elif k == "image":
                sl.shapes.add_picture(e["path"], Inches(e["x"]), Inches(e["y"]), Inches(e["w"]), Inches(e["h"]))
            elif k == "text":
                tb = sl.shapes.add_textbox(Inches(e["x"]), Inches(e["y"]), Inches(e["w"]), Inches(e["h"]))
                if e["name"]:
                    tb.name = e["name"]
                tf = tb.text_frame
                tf.word_wrap = True
                tf.auto_size = MSO_AUTO_SIZE.NONE
                tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
                tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[
                    e["valign"]]
                for pi, p in enumerate(e["paras"]):
                    para = tf.paragraphs[0] if pi == 0 else tf.add_paragraph()
                    para.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[
                        p.get("align", e["align"])]
                    para.line_spacing = p.get("ls", e["ls"])
                    if p.get("space_after"):
                        para.space_after = Pt(p["space_after"])
                    for r in p["runs"]:
                        run = para.add_run()
                        run.text = r["text"]
                        f = run.font
                        f.size = Pt(r.get("size", e["size"]))
                        f.bold = r.get("bold", e["bold"])
                        f.italic = r.get("italic", e["italic"])
                        rPr = run._r.get_or_add_rPr()
                        if r.get("grad"):
                            rPr.insert(0, _grad_xml([(0, r["grad"][0]), (100000, r["grad"][1])], 0))
                        else:
                            f.color.rgb = _rgb(r.get("color", e["color"]))
                        f.name = r.get("font", e["font"])
                        sp = r.get("spacing", e["spacing"])
                        if sp:
                            rPr.set("spc", str(int(sp * 100)))
        if sd.notes:
            sl.notes_slide.notes_text_frame.text = sd.notes
    prs.core_properties.title = "Kapora: Trustless Deposits for Marketplaces"
    prs.core_properties.author = "Kapora Protocol"
    prs.save(out)


# ---------------------------------------------------------------- HTML renderer
def _css_font(f):
    return f"'{f}', 'Segoe UI', Arial, sans-serif" if f == SANS else f"'{f}', 'Courier New', monospace"


def render_html(slides, out):
    parts = ["""<!doctype html><html><head><meta charset="utf-8"><title>Kapora deck</title><style>
@page { size: 13.333in 7.5in; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #000; }
.slide { position: relative; width: 13.333in; height: 7.5in; overflow: hidden; page-break-after: always;
         break-after: page; background-size: 100% 100%; }
.slide:last-child { page-break-after: auto; break-after: auto; }
.el { position: absolute; }
.tx { display: flex; flex-direction: column; overflow: visible; }
.tx p { margin: 0; white-space: pre-wrap; }
svg.lines { position: absolute; left: 0; top: 0; width: 13.333in; height: 7.5in; overflow: visible; }
@media screen { .slide { margin: 0 auto 24px; } }
</style></head><body>"""]
    for sd in slides:
        bgurl = (ASSETS / sd.bg).as_uri()
        parts.append(f'<section class="slide" style="background-image:url(\'{bgurl}\')">')
        svg = []
        for e in sd.els:
            k = e["kind"]
            if k == "rect":
                st = [f"left:{e['x']}in", f"top:{e['y']}in", f"width:{e['w']}in", f"height:{e['h']}in"]
                if e["radius"]:
                    st.append(f"border-radius:{min(e['radius'], min(e['w'], e['h']) / 2)}in")
                if e["grad"]:
                    st.append(f"background:linear-gradient(90deg,#{e['grad'][0]},#{e['grad'][1]})")
                elif e["fill"]:
                    st.append(f"background:#{e['fill']}")
                if e["line"]:
                    st.append(f"border:{e['lw']}pt {'dashed' if e['dash'] else 'solid'} #{e['line']}")
                parts.append(f'<div class="el" style="{";".join(st)}"></div>')
            elif k == "image":
                parts.append(f'<img class="el" src="{Path(e["path"]).as_uri()}" style="left:{e["x"]}in;'
                             f'top:{e["y"]}in;width:{e["w"]}in;height:{e["h"]}in">')
            elif k == "line":
                X = lambda v: v * 96  # noqa: E731
                lw = e["lw"] * 96 / 72
                x2, y2 = X(e["x2"]), X(e["y2"])
                if e["arrow"]:
                    # shorten the shaft so the head ends at the target point
                    import math
                    dx, dy = X(e["x2"]) - X(e["x1"]), X(e["y2"]) - X(e["y1"])
                    L = math.hypot(dx, dy) or 1
                    hl = max(7.0, lw * 3.2)
                    ux, uy = dx / L, dy / L
                    bx, by = x2 - ux * hl, y2 - uy * hl
                    px, py = -uy * hl * 0.5, ux * hl * 0.5
                    svg.append(f'<line x1="{X(e["x1"]):.2f}" y1="{X(e["y1"]):.2f}" x2="{bx:.2f}" y2="{by:.2f}" '
                               f'stroke="#{e["color"]}" stroke-width="{lw:.2f}"/>')
                    svg.append(f'<polygon points="{x2:.2f},{y2:.2f} {bx + px:.2f},{by + py:.2f} '
                               f'{bx - px:.2f},{by - py:.2f}" fill="#{e["color"]}"/>')
                else:
                    da = ' stroke-dasharray="6 5"' if e["dash"] else ""
                    svg.append(f'<line x1="{X(e["x1"]):.2f}" y1="{X(e["y1"]):.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
                               f'stroke="#{e["color"]}" stroke-width="{lw:.2f}"{da}/>')
            if k == "line" and svg:
                parts.append(f'<svg class="lines" viewBox="0 0 {SW * 96:.1f} {SH * 96:.1f}">{"".join(svg)}</svg>')
                svg = []
            if k == "text":
                jc = {"t": "flex-start", "m": "center", "b": "flex-end"}[e["valign"]]
                st = [f"left:{e['x']}in", f"top:{e['y']}in", f"width:{e['w']}in", f"height:{e['h']}in",
                      f"justify-content:{jc}"]
                ps = []
                for p in e["paras"]:
                    al = {"l": "left", "c": "center", "r": "right"}[p.get("align", e["align"])]
                    lh = LH.get(e["font"], 1.3) * p.get("ls", e["ls"])
                    pst = [f"text-align:{al}", f"line-height:{lh:.3f}",
                           f"font-family:{_css_font(e['font'])}", f"font-size:{e['size']}pt"]
                    if p.get("space_after"):
                        pst.append(f"margin-bottom:{p['space_after']}pt")
                    if e["pre"]:
                        pst.append("white-space:pre")
                    if len(p["runs"]) == 1 and p["runs"][0].get("grad"):
                        # gradient text as SVG (vector, no clip-box artefacts in PDF viewers)
                        r = p["runs"][0]
                        g = r["grad"]
                        fs = r.get("size", e["size"])
                        gid = f"g{id(r)}"
                        anchor, gx = {"left": ("start", "0"), "center": ("middle", "50%"),
                                      "right": ("end", "100%")}[al]
                        ps.append(
                            f'<svg style="display:block;overflow:visible" width="100%" height="{lh * fs:.2f}pt">'
                            f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="0">'
                            f'<stop offset="0" stop-color="#{g[0]}"/><stop offset="1" stop-color="#{g[1]}"/>'
                            f'</linearGradient></defs>'
                            f'<text x="{gx}" y="{1.079 * fs * (1 + (p.get("ls", e["ls"]) - 1) / 2):.2f}pt" '
                            f'text-anchor="{anchor}" fill="url(#{gid})" style="font-family:{_css_font(r.get("font", e["font"]))};'
                            f'font-size:{fs}pt;font-weight:{700 if r.get("bold", e["bold"]) else 400}">'
                            f'{html.escape(r["text"])}</text></svg>')
                        continue
                    rs = []
                    for r in p["runs"]:
                        f = r.get("font", e["font"])
                        rst = [f"font-family:{_css_font(f)}", f"font-size:{r.get('size', e['size'])}pt",
                               f"font-weight:{700 if r.get('bold', e['bold']) else 400}",
                               f"font-style:{'italic' if r.get('italic', e['italic']) else 'normal'}"]
                        sp = r.get("spacing", e["spacing"])
                        if sp:
                            rst.append(f"letter-spacing:{sp}pt")
                        if r.get("grad"):
                            g = r["grad"]
                            rst.append(f"background:linear-gradient(90deg,#{g[0]},#{g[1]});"
                                       "-webkit-background-clip:text;background-clip:text;color:transparent")
                        else:
                            rst.append(f"color:#{r.get('color', e['color'])}")
                        rs.append(f'<span style="{";".join(rst)}">{html.escape(r["text"])}</span>')
                    ps.append(f'<p style="{";".join(pst)}">{"".join(rs)}</p>')
                parts.append(f'<div class="el tx" style="{";".join(st)}">{"".join(ps)}</div>')
        parts.append("</section>")
    parts.append("</body></html>")
    Path(out).write_text("\n".join(parts), encoding="utf-8")


# ---------------------------------------------------------------- PDF + previews
def find_browser():
    cands = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        shutil.which("msedge") or "", shutil.which("google-chrome") or "", shutil.which("chromium") or "",
    ]
    for c in cands:
        if c and os.path.exists(c):
            return c
    return None


def print_pdf(html_path, pdf_path):
    b = find_browser()
    if not b:
        print("!! No Edge/Chrome found - skipping PDF. Open deck.html and print to PDF manually.")
        return False
    if os.path.exists(pdf_path):
        os.remove(pdf_path)
    prof = HERE / ".browser-profile"
    cmd = [b, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={prof}",
           "--no-pdf-header-footer", "--print-to-pdf-no-header", "--allow-file-access-from-files",
           f"--print-to-pdf={pdf_path}", Path(html_path).as_uri()]
    subprocess.run(cmd, check=False, timeout=180, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.rmtree(prof, ignore_errors=True)
    ok = os.path.exists(pdf_path)
    print(("PDF written: " if ok else "!! PDF failed: ") + str(pdf_path))
    return ok


def render_previews(pdf_path):
    try:
        import pymupdf
    except ImportError:
        try:
            import fitz as pymupdf
        except ImportError:
            print("(pymupdf not installed - skipping PNG previews)")
            return
    PREVIEW.mkdir(exist_ok=True)
    for old in PREVIEW.glob("slide-*.png"):
        old.unlink()
    doc = pymupdf.open(str(pdf_path))
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
        pix.save(str(PREVIEW / f"slide-{i + 1:02d}.png"))
    print(f"{len(doc)} pages -> {PREVIEW}")


def main():
    make_backgrounds()
    slides = build_slides()
    assert len(slides) <= 10
    render_pptx(slides, HERE / "deck.pptx")
    print("PPTX written:", HERE / "deck.pptx")
    render_html(slides, HERE / "deck.html")
    if "--no-pdf" not in sys.argv:
        if print_pdf(HERE / "deck.html", HERE / "deck.pdf"):
            render_previews(HERE / "deck.pdf")


if __name__ == "__main__":
    main()
