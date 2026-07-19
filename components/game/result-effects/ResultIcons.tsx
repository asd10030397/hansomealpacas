"use client";

/** Lightweight SVG icons for settlement result presentation. */

import { useId } from "react";

/** Four deep predator claw scars — rake swipe silhouette. */
export function ClawSlashIcon({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const core = `hg-claw-core-${uid}`;
  const edge = `hg-claw-edge-${uid}`;
  const glow = `hg-claw-glow-${uid}`;

  // Four curved claw scars: wide entry → needle tip (predator rake).
  // Each: [outer red edge, inner dark gouge]
  const claws: [string, string][] = [
    [
      "M6 4 L14 2 C28 16 44 34 58 56 L52 60 C40 42 24 22 10 8 Z",
      "M9 6 L13 5 C26 18 42 36 54 54 L51 56 C40 40 26 22 12 10 Z",
    ],
    [
      "M22 2 L30 0 C46 14 62 34 76 56 L70 60 C58 42 42 20 26 6 Z",
      "M25 4 L29 3 C44 16 60 36 72 54 L69 56 C58 40 44 20 28 8 Z",
    ],
    [
      "M40 1 L48 0 C64 14 80 34 94 54 L88 58 C76 40 60 18 44 5 Z",
      "M43 3 L47 2 C62 16 78 34 90 52 L87 54 C76 38 62 18 46 7 Z",
    ],
    [
      "M58 3 L66 1 C80 16 94 34 106 52 L100 56 C90 40 76 20 62 7 Z",
      "M61 5 L65 4 C78 18 92 34 102 50 L99 52 C90 38 78 20 64 9 Z",
    ],
  ];

  return (
    <svg className={className} viewBox="0 0 108 68" aria-hidden overflow="visible">
      <defs>
        <linearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8a8a" />
          <stop offset="40%" stopColor="#e01528" />
          <stop offset="100%" stopColor="#6a0810" />
        </linearGradient>
        <linearGradient id={core} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a0508" />
          <stop offset="55%" stopColor="#8a1018" />
          <stop offset="100%" stopColor="#1a0204" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {claws.map(([outer, inner], i) => (
        <g
          key={i}
          className={`hg-result-fx__claw-group hg-result-fx__claw-group--${i}`}
          filter={`url(#${glow})`}
        >
          <path d={outer} fill={`url(#${edge})`} opacity="0.95" />
          <path d={inner} fill={`url(#${core})`} opacity="0.9" />
        </g>
      ))}
    </svg>
  );
}

export function HappyAlpacaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 88" aria-hidden>
      <defs>
        <linearGradient id="hg-safe-wool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff8ef" />
          <stop offset="100%" stopColor="#e8d4b8" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="58" rx="22" ry="18" fill="url(#hg-safe-wool)" />
      <rect x="28" y="70" width="5" height="12" rx="2" fill="#c9b08a" />
      <rect x="47" y="70" width="5" height="12" rx="2" fill="#c9b08a" />
      <ellipse cx="40" cy="36" rx="14" ry="16" fill="url(#hg-safe-wool)" />
      <circle cx="28" cy="28" r="7" fill="#fff8ef" />
      <circle cx="52" cy="28" r="7" fill="#fff8ef" />
      <circle cx="40" cy="20" r="8" fill="#fff8ef" />
      <ellipse cx="40" cy="40" rx="11" ry="10" fill="#f0e0c8" />
      <circle cx="35" cy="38" r="1.6" fill="#2a1f14" />
      <circle cx="45" cy="38" r="1.6" fill="#2a1f14" />
      <ellipse cx="40" cy="43" rx="3.2" ry="2.2" fill="#c48a6a" />
      <path
        d="M34 46c2.2 3 9.8 3 12 0"
        stroke="#2a1f14"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="30" cy="43" r="2.2" fill="#f2a0a0" opacity="0.55" />
      <circle cx="50" cy="43" r="2.2" fill="#f2a0a0" opacity="0.55" />
    </svg>
  );
}

/** Predator jaws only — upper + lower with white fangs (no full head). */
export function CougarBiteIcon({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const gum = `hg-jaw-gum-${uid}`;

  return (
    <svg className={className} viewBox="0 0 100 90" aria-hidden overflow="visible">
      <defs>
        <linearGradient id={gum} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a3420" />
          <stop offset="100%" stopColor="#2a100c" />
        </linearGradient>
      </defs>

      {/* Upper jaw — snaps down */}
      <g className="hg-result-fx__jaw-upper">
        <path
          d="M8 36 C18 14 82 14 92 36 L80 44 C70 26 30 26 20 44 Z"
          fill={`url(#${gum})`}
          stroke="#1a0a08"
          strokeWidth="1.6"
        />
        {/* Upper fangs — large canines + side teeth */}
        <path d="M24 40 L28 64 L32 40 Z" fill="#f7f2e8" stroke="#d8d0c0" strokeWidth="0.5" />
        <path d="M38 38 L43 68 L48 38 Z" fill="#fffaf0" stroke="#e8e0d0" strokeWidth="0.6" />
        <path d="M52 38 L57 68 L62 38 Z" fill="#fffaf0" stroke="#e8e0d0" strokeWidth="0.6" />
        <path d="M68 40 L72 64 L76 40 Z" fill="#f7f2e8" stroke="#d8d0c0" strokeWidth="0.5" />
        <path d="M33 40 L35.5 54 L38 40 Z" fill="#efe8dc" />
        <path d="M62 40 L64.5 54 L67 40 Z" fill="#efe8dc" />
      </g>

      {/* Lower jaw — snaps up */}
      <g className="hg-result-fx__jaw-lower">
        <path
          d="M14 58 C24 82 76 82 86 58 L76 50 C66 70 34 70 24 50 Z"
          fill={`url(#${gum})`}
          stroke="#1a0a08"
          strokeWidth="1.6"
        />
        {/* Lower fangs */}
        <path d="M28 54 L32 36 L36 54 Z" fill="#f7f2e8" stroke="#d8d0c0" strokeWidth="0.5" />
        <path d="M44 56 L50 32 L56 56 Z" fill="#fffaf0" stroke="#e8e0d0" strokeWidth="0.6" />
        <path d="M64 54 L68 36 L72 54 Z" fill="#f7f2e8" stroke="#d8d0c0" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

export function SadCougarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 72" aria-hidden>
      <defs>
        <linearGradient id="hg-sad-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4924a" />
          <stop offset="100%" stopColor="#9a5a22" />
        </linearGradient>
      </defs>
      <ellipse cx="42" cy="42" rx="22" ry="14" fill="url(#hg-sad-fur)" />
      <rect x="28" y="50" width="5" height="12" rx="2" fill="#8a4a14" />
      <rect x="40" y="50" width="5" height="12" rx="2" fill="#8a4a14" />
      <rect x="50" y="50" width="5" height="12" rx="2" fill="#8a4a14" />
      <ellipse cx="24" cy="36" rx="14" ry="12" fill="url(#hg-sad-fur)" />
      <path d="M14 30 L10 18 L22 26 Z" fill="#c67a2e" />
      <path d="M30 28 L36 18 L28 28 Z" fill="#c67a2e" />
      <ellipse cx="20" cy="34" rx="2.2" ry="1.6" fill="#1a1208" />
      <ellipse cx="28" cy="34" rx="2.2" ry="1.6" fill="#1a1208" />
      <path
        d="M20 40c2-2 6-2 8 0"
        stroke="#3a2010"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        className="hg-result-fx__tail"
        d="M62 42 Q78 36 84 50"
        stroke="#c67a2e"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
