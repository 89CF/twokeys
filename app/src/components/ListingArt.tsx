import clsx from "clsx";
import type { Listing } from "@/data/listings";

/** Generated SVG "photos" for demo listings (no external images). */
export function ListingArt({ listing, className }: { listing: Listing; className?: string }) {
  const { from, to } = listing.art;
  const gid = `g-${listing.id}`;
  return (
    <div className={clsx("relative overflow-hidden", className)}>
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <radialGradient id={`${gid}-sun`} cx="0.78" cy="0.22" r="0.5">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="260" fill={`url(#${gid}-bg)`} />
        <rect width="400" height="260" fill={`url(#${gid}-sun)`} />
        {listing.site === "auto" ? <Car listing={listing} /> : <Gear listing={listing} />}
      </svg>
    </div>
  );
}

function Car({ listing }: { listing: Listing }) {
  const { body, accent, variant } = listing.art;
  // Variants tweak the roofline / height a bit.
  const roof =
    variant === "suv"
      ? "M150 112 L176 78 Q186 68 204 68 L270 68 Q288 68 300 82 L326 112 Z"
      : variant === "city"
        ? "M160 116 L184 84 Q194 74 210 74 L254 74 Q272 74 282 88 L300 116 Z"
        : variant === "estate"
          ? "M150 116 L176 86 Q186 78 202 78 L300 78 Q312 78 318 90 L330 116 Z"
          : "M152 116 L178 86 Q188 78 204 78 L262 78 Q280 78 292 92 L318 116 Z";
  const bodyTop = variant === "suv" ? 108 : 112;
  return (
    <g>
      {/* road */}
      <rect y="206" width="400" height="54" fill="#000" opacity="0.25" />
      <rect x="20" y="228" width="60" height="4" rx="2" fill="#fff" opacity="0.15" />
      <rect x="170" y="228" width="60" height="4" rx="2" fill="#fff" opacity="0.15" />
      <rect x="320" y="228" width="60" height="4" rx="2" fill="#fff" opacity="0.15" />
      <ellipse cx="210" cy="206" rx="170" ry="10" fill="#000" opacity="0.35" />
      {/* roof + windows */}
      <path d={roof} fill={body} opacity="0.92" />
      <path d={roof} fill="#0b1220" opacity="0.55" transform="translate(6 5) scale(0.97)" />
      {/* body */}
      <path
        d={`M54 196 L54 ${bodyTop + 26} Q56 ${bodyTop + 6} 84 ${bodyTop + 2} L140 ${bodyTop} L330 ${bodyTop} L356 ${bodyTop + 6} Q372 ${bodyTop + 12} 372 ${bodyTop + 34} L372 196 Z`}
        fill={body}
      />
      <path d={`M60 ${bodyTop + 40} L366 ${bodyTop + 40}`} stroke="#000" strokeOpacity="0.12" strokeWidth="2" />
      {/* lights */}
      <rect x="352" y={bodyTop + 14} width="18" height="9" rx="4" fill={accent} />
      <rect x="56" y={bodyTop + 16} width="12" height="8" rx="3" fill="#f43f5e" opacity="0.9" />
      {/* wheels */}
      {[118, 306].map((x) => (
        <g key={x}>
          <circle cx={x} cy="196" r="27" fill="#0b0f19" />
          <circle cx={x} cy="196" r="14" fill="#94a3b8" />
          <circle cx={x} cy="196" r="5" fill="#334155" />
        </g>
      ))}
    </g>
  );
}

function Gear({ listing }: { listing: Listing }) {
  const { body, accent, variant } = listing.art;
  const dark = "#0b1220";
  return (
    <g>
      {/* studio floor + soft shadow */}
      <rect y="214" width="400" height="46" fill="#000" opacity="0.22" />
      <ellipse cx="200" cy="214" rx="130" ry="9" fill="#000" opacity="0.35" />
      {variant === "camera" && (
        <g>
          <rect x="108" y="96" width="184" height="112" rx="16" fill={dark} />
          <rect x="128" y="78" width="64" height="26" rx="6" fill={dark} />
          <rect x="250" y="84" width="26" height="14" rx="4" fill={accent} />
          <rect x="108" y="120" width="184" height="10" fill="#1f2937" />
          <circle cx="200" cy="154" r="46" fill="#1f2937" />
          <circle cx="200" cy="154" r="34" fill={body} opacity="0.25" />
          <circle cx="200" cy="154" r="22" fill="#020617" />
          <circle cx="190" cy="144" r="7" fill="#fff" opacity="0.55" />
          <circle cx="270" cy="114" r="5" fill={accent} />
        </g>
      )}
      {variant === "laptop" && (
        <g>
          <rect x="112" y="62" width="176" height="118" rx="10" fill={dark} />
          <rect x="122" y="72" width="156" height="98" rx="4" fill="#1e293b" />
          <rect x="132" y="84" width="80" height="8" rx="4" fill={accent} opacity="0.9" />
          <rect x="132" y="100" width="120" height="6" rx="3" fill={body} opacity="0.35" />
          <rect x="132" y="112" width="96" height="6" rx="3" fill={body} opacity="0.35" />
          <rect x="132" y="130" width="136" height="30" rx="4" fill={accent} opacity="0.18" />
          <path d="M88 186 L312 186 L300 204 L100 204 Z" fill={body} />
          <rect x="176" y="186" width="48" height="5" rx="2" fill="#94a3b8" />
        </g>
      )}
      {variant === "drone" && (
        <g>
          {[
            [110, 112],
            [290, 112],
            [110, 178],
            [290, 178],
          ].map(([x, y], i) => (
            <g key={i}>
              <line x1="200" y1="145" x2={x} y2={y} stroke={dark} strokeWidth="10" strokeLinecap="round" />
              <ellipse cx={x} cy={y - 10} rx="40" ry="6" fill={body} opacity="0.5" />
              <circle cx={x} cy={y} r="10" fill={dark} />
            </g>
          ))}
          <rect x="166" y="124" width="68" height="44" rx="14" fill={dark} />
          <circle cx="200" cy="176" r="11" fill="#1f2937" />
          <circle cx="200" cy="176" r="5" fill={accent} />
          <rect x="186" y="132" width="28" height="5" rx="2" fill={accent} />
        </g>
      )}
      {variant === "lens" && (
        <g>
          <rect x="120" y="104" width="170" height="96" rx="12" fill={dark} />
          <rect x="150" y="104" width="12" height="96" fill="#1f2937" />
          <rect x="200" y="104" width="30" height="96" fill="#111827" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={203 + i * 4.5} y="106" width="2" height="92" fill="#374151" />
          ))}
          <rect x="114" y="98" width="12" height="108" rx="4" fill={accent} opacity="0.8" />
          <ellipse cx="290" cy="152" rx="16" ry="48" fill="#1f2937" />
          <ellipse cx="292" cy="152" rx="10" ry="34" fill={body} opacity="0.35" />
        </g>
      )}
      {variant === "projector" && (
        <g>
          <rect x="100" y="116" width="200" height="86" rx="18" fill={body} />
          <circle cx="250" cy="159" r="30" fill={dark} />
          <circle cx="250" cy="159" r="18" fill="#1f2937" />
          <circle cx="250" cy="159" r="8" fill={accent} />
          {Array.from({ length: 5 }, (_, i) => (
            <rect key={i} x={124} y={134 + i * 10} width="70" height="4" rx="2" fill="#94a3b8" />
          ))}
          <path d="M276 140 L400 70 L400 250 L276 178 Z" fill={accent} opacity="0.12" />
        </g>
      )}
    </g>
  );
}
