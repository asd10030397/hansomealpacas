/** Lightweight inline SVGs / sprites for ability presentation. */

export function GuardianShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="hg-guard-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8fbff" />
          <stop offset="45%" stopColor="#5ec8ff" />
          <stop offset="100%" stopColor="#1f78d8" />
        </linearGradient>
      </defs>
      <path
        d="M32 6c8 4 16 5 22 6v18c0 14-9 24-22 28C19 54 10 44 10 30V12c6-1 14-2 22-6z"
        fill="url(#hg-guard-g)"
        stroke="#b9f3ff"
        strokeWidth="2"
      />
      <path
        d="M32 16v28M22 28h20"
        stroke="#e9fcff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

/**
 * Reference art: red winged high-tops with large white feathers
 * (transparent PNG — no card/frame background).
 * Mirrored in CSS so toes face the dash direction (right).
 */
export function RunnerShoesIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- lightweight VFX sprite, not layout LCP
    <img
      className={className}
      src="/assets/ui/abilities/runner-winged-shoes.png?v=2"
      alt=""
      draggable={false}
      decoding="async"
    />
  );
}

export function LuckyCloverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id="hg-luck-g" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#d8ff9a" />
          <stop offset="55%" stopColor="#3fcf5a" />
          <stop offset="100%" stopColor="#1f8f3a" />
        </radialGradient>
      </defs>
      <path d="M32 30v26" stroke="#c9a227" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="24" r="9" fill="url(#hg-luck-g)" />
      <circle cx="42" cy="24" r="9" fill="url(#hg-luck-g)" />
      <circle cx="22" cy="38" r="9" fill="url(#hg-luck-g)" />
      <circle cx="42" cy="38" r="9" fill="url(#hg-luck-g)" />
      <circle cx="32" cy="31" r="4" fill="#ffe56a" />
    </svg>
  );
}

export function FarmerWheatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 72" aria-hidden>
      <defs>
        <linearGradient id="hg-farm-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1a8" />
          <stop offset="40%" stopColor="#f0c44a" />
          <stop offset="100%" stopColor="#c68620" />
        </linearGradient>
      </defs>
      <path
        d="M24 68V28"
        stroke="#8a6a20"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 14 + i * 8;
        return (
          <g key={i}>
            <ellipse
              cx="16"
              cy={y}
              rx="7"
              ry="3.5"
              fill="url(#hg-farm-g)"
              transform={`rotate(-28 16 ${y})`}
            />
            <ellipse
              cx="32"
              cy={y + 2}
              rx="7"
              ry="3.5"
              fill="url(#hg-farm-g)"
              transform={`rotate(28 32 ${y + 2})`}
            />
          </g>
        );
      })}
      <ellipse cx="24" cy="10" rx="5" ry="7" fill="url(#hg-farm-g)" />
    </svg>
  );
}
