"use client";

import { m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { ASSETS, PROJECT } from "@/content/project";
import { EASE } from "@/lib/motion";

type GoldCoinProps = {
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
};

const COIN_DEPTH = 18;

function CoinFace({
  children,
  variant = "front",
  highlight = "35% 28%",
}: {
  children: ReactNode;
  variant?: "front" | "back";
  highlight?: string;
}) {
  const transformStyle =
    variant === "back"
      ? {
          transform: `rotateY(180deg) translateZ(${COIN_DEPTH}px)`,
          backfaceVisibility: "hidden" as const,
        }
      : {
          transform: `translateZ(${COIN_DEPTH}px)`,
          backfaceVisibility: "hidden" as const,
        };

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-full"
      style={{
        ...transformStyle,
        background: `radial-gradient(circle at ${highlight}, #fffaea 0%, #ffe7a6 16%, #f2b33d 42%, #c98f3b 68%, #5c3a1b 100%)`,
        boxShadow:
          "inset 0 10px 28px rgba(255,255,255,0.45), inset 0 -16px 32px rgba(92,58,27,0.45), 0 0 48px rgba(242,179,61,0.35)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-[3%] rounded-full"
        style={{
          border: "2px solid rgba(255,255,255,0.3)",
          boxShadow: "inset 0 0 24px rgba(255,255,255,0.1)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-[10%] rounded-full"
        style={{
          border: "1px solid rgba(92,58,27,0.4)",
          background:
            "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.08) 0deg 8deg, rgba(92,58,27,0.1) 8deg 16deg)",
        }}
      />
      {children}
    </div>
  );
}

export function GoldCoin({ interactive = false, onClick, className = "" }: GoldCoinProps) {
  const reduceMotion = useReducedMotion();

  const coin = (
    <div
      className={`coin-scene mx-auto h-[min(84vw,34rem)] w-[min(84vw,34rem)] sm:h-[min(68vw,36rem)] sm:w-[min(68vw,36rem)] md:h-[36rem] md:w-[36rem] ${className}`}
    >
      <div className={`relative h-full w-full ${reduceMotion ? "" : "coin-float"}`}>
        <div
          className="absolute inset-[4%]"
          style={{ transformStyle: "preserve-3d" }}
        >
          <CoinFace>
            <div className="absolute inset-[14%] flex items-center justify-center">
              <img
                src={ASSETS.mascotCutout}
                alt={`${PROJECT.name} mascot`}
                className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
              />
            </div>
            <p className="pointer-events-none absolute inset-x-[8%] top-[6%] text-center font-[family-name:var(--font-anton)] text-[clamp(0.65rem,2.8vw,0.95rem)] tracking-[0.35em] text-[#5c3a1b]/85">
              {PROJECT.symbol}
            </p>
            <p className="pointer-events-none absolute inset-x-[8%] bottom-[6%] text-center font-[family-name:var(--font-anton)] text-[clamp(0.65rem,2.8vw,0.95rem)] tracking-[0.35em] text-[#5c3a1b]/85">
              {PROJECT.name}
            </p>
          </CoinFace>

          <CoinFace variant="back" highlight="62% 32%">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <span className="font-[family-name:var(--font-anton)] text-[clamp(2rem,10vw,3.5rem)] tracking-[0.1em] text-[#5c3a1b] drop-shadow-[0_2px_0_rgba(255,255,255,0.4)]">
                {PROJECT.symbol}
              </span>
              <span className="font-[family-name:var(--font-anton)] text-[clamp(0.85rem,3.5vw,1.25rem)] tracking-[0.28em] text-[#5c3a1b]">
                {PROJECT.name}
              </span>
            </div>
          </CoinFace>

          <div
            className="absolute inset-0 rounded-full"
            style={{
              transform: "translateZ(0)",
              background:
                "repeating-conic-gradient(from 0deg, #5c3a1b 0deg 3deg, #ffe7a6 3deg 6deg, #c98f3b 6deg 9deg, #8b5a2b 9deg 12deg)",
              mask: "radial-gradient(circle, transparent calc(100% - 20px), black calc(100% - 18px))",
              WebkitMask:
                "radial-gradient(circle, transparent calc(100% - 20px), black calc(100% - 18px))",
            }}
          />
        </div>

        <div
          aria-hidden="true"
          className="absolute -bottom-6 left-1/2 h-10 w-[75%] -translate-x-1/2 rounded-[100%] blur-3xl"
          style={{ background: "rgba(242,179,61,0.4)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 left-1/2 h-32 w-[55%] -translate-x-1/2 rounded-[100%] blur-3xl"
          style={{ background: "rgba(255,231,166,0.3)" }}
        />
      </div>
    </div>
  );

  if (!interactive) return coin;

  return (
    <m.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.85, ease: EASE }}
      className="cursor-pointer border-0 bg-transparent p-0"
      aria-label={`${PROJECT.symbol} coin`}
    >
      {coin}
    </m.button>
  );
}
