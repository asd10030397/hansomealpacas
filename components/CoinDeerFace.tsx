export function CoinDeerFace({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="coinFaceGold" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFF0B0" />
          <stop offset="35%" stopColor="#E6C35C" />
          <stop offset="70%" stopColor="#A67C00" />
          <stop offset="100%" stopColor="#5C3D00" />
        </radialGradient>
        <linearGradient id="coinEmbossHi" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF8D6" />
          <stop offset="100%" stopColor="#C9A227" />
        </linearGradient>
        <linearGradient id="coinEmbossLo" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#3D2800" />
          <stop offset="100%" stopColor="#7A5200" />
        </linearGradient>
        <filter id="coinRelief" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#1A1000" floodOpacity="0.55" />
          <feDropShadow dx="0" dy="-1" stdDeviation="0.5" floodColor="#FFF2B0" floodOpacity="0.35" />
        </filter>
      </defs>

      <circle cx="100" cy="100" r="88" fill="url(#coinFaceGold)" filter="url(#coinRelief)" />

      <g filter="url(#coinRelief)">
        <ellipse cx="100" cy="108" rx="42" ry="58" fill="url(#coinEmbossHi)" />
        <path
          fill="url(#coinEmbossHi)"
          d="M68 72 C52 78 44 96 52 112 C58 100 62 84 68 72 Z"
        />
        <path
          fill="url(#coinEmbossHi)"
          d="M132 68 C148 76 156 96 148 112 C142 98 138 82 132 68 Z"
        />
        <path fill="url(#coinEmbossLo)" d="M82 44 C76 34 74 24 78 18 C80 14 86 16 88 24 C90 32 86 40 82 44 Z" />
        <path fill="url(#coinEmbossLo)" d="M88 38 C80 30 74 22 72 16 C70 12 78 10 82 18 C86 26 88 34 88 38 Z" />
        <path fill="url(#coinEmbossLo)" d="M118 42 C126 32 132 24 134 18 C136 14 128 12 124 20 C120 28 118 36 118 42 Z" />
        <path fill="url(#coinEmbossLo)" d="M112 36 C120 28 128 20 130 14 C132 10 124 8 120 16 C116 24 112 32 112 36 Z" />
        <ellipse cx="102" cy="132" rx="24" ry="28" fill="url(#coinEmbossLo)" transform="rotate(4 102 132)" />
        <ellipse cx="78" cy="96" rx="16" ry="8" fill="#1A1208" />
        <circle cx="122" cy="92" r="10" fill="#1A1208" />
        <circle cx="82" cy="94" r="2.5" fill="#FFF8D0" opacity="0.45" />
        <ellipse cx="104" cy="126" rx="5" ry="4.5" fill="#2A1808" />
        <path
          fill="#2A1808"
          d="M92 144 C96 148 108 148 112 144 C112 147 106 150 102 150 C98 150 92 147 92 144 Z"
        />
        <path
          fill="#8B4040"
          d="M100 148 C96 156 94 164 96 170 C98 166 102 164 106 164 C110 164 114 166 116 170 C118 164 116 156 112 148 C108 152 104 153 100 148 Z"
        />
        <circle cx="76" cy="118" r="4.5" fill="#6B5A20" opacity="0.7" />
        <circle cx="124" cy="108" r="3.5" fill="#6B5A20" opacity="0.7" />
      </g>
    </svg>
  );
}
