"use client";

import { m, useReducedMotion } from "framer-motion";
import { PROJECT } from "@/content/project";
import { EASE } from "@/lib/motion";

type GoldCoinProps = {
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
};

export function GoldCoin({ interactive = false, onClick, className = "" }: GoldCoinProps) {
  const reduceMotion = useReducedMotion();

  const coin = (
    <div
      className={`coin-scene mx-auto h-[min(72vw,28rem)] w-[min(72vw,28rem)] sm:h-[min(60vw,32rem)] sm:w-[min(60vw,32rem)] md:h-[30rem] md:w-[30rem] ${className}`}
    >
      <div className={`relative h-full w-full ${reduceMotion ? "" : "coin-float"}`}>
        <div
          className={`absolute inset-[8%] ${reduceMotion ? "" : "coin-spin"}`}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front face */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full"
            style={{
              transform: "translateZ(12px)",
              backfaceVisibility: "hidden",
              background:
                "radial-gradient(circle at 35% 30%, #fff4c2 0%, #f5d061 18%, #d4af37 45%, #a67c00 72%, #6b4f0a 100%)",
              boxShadow:
                "inset 0 8px 24px rgba(255,255,255,0.35), inset 0 -12px 28px rgba(0,0,0,0.45), 0 0 60px rgba(212,175,55,0.35)",
            }}
          >
            <div
              className="absolute inset-[6%] rounded-full border border-white/20"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.12), transparent 60%)",
              }}
            />
            <span className="font-[family-name:var(--font-anton)] text-[clamp(3rem,14vw,5.5rem)] tracking-[0.08em] text-[#4a3200] drop-shadow-[0_2px_0_rgba(255,255,255,0.35)]">
              {PROJECT.symbol}
            </span>
          </div>

          {/* Back face */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full"
            style={{
              transform: "rotateY(180deg) translateZ(12px)",
              backfaceVisibility: "hidden",
              background:
                "radial-gradient(circle at 65% 35%, #fff4c2 0%, #f5d061 20%, #d4af37 50%, #8b6914 100%)",
              boxShadow: "inset 0 -8px 24px rgba(0,0,0,0.35)",
            }}
          >
            <span className="font-[family-name:var(--font-anton)] text-[clamp(1.25rem,5vw,2rem)] tracking-[0.12em] text-[#4a3200]">
              UGLY
            </span>
          </div>

          {/* Edge */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              transform: "translateZ(0)",
              background:
                "conic-gradient(from 0deg, #6b4f0a, #d4af37, #f5d061, #a67c00, #6b4f0a, #d4af37, #f5d061, #6b4f0a)",
              mask: "radial-gradient(circle, transparent calc(100% - 14px), black calc(100% - 13px))",
              WebkitMask:
                "radial-gradient(circle, transparent calc(100% - 14px), black calc(100% - 13px))",
            }}
          />
        </div>

        {/* Ground glow */}
        <div
          aria-hidden="true"
          className="absolute -bottom-4 left-1/2 h-8 w-[70%] -translate-x-1/2 rounded-[100%] blur-2xl"
          style={{ background: "rgba(212,175,55,0.35)" }}
        />
      </div>
    </div>
  );

  if (!interactive) return coin;

  return (
    <m.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 1, ease: EASE }}
      className="cursor-pointer border-0 bg-transparent p-0"
      aria-label={`${PROJECT.symbol} coin`}
    >
      {coin}
    </m.button>
  );
}
