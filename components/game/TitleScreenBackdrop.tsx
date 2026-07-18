"use client";

import Image from "next/image";
import { AlpacaRanchScene } from "./AlpacaRanchScene";
import { CougarTerritoryScene } from "./CougarTerritoryScene";

/**
 * Title-screen world stage.
 * Left / right are mirrored faction scenes for visual symmetry.
 */
export function TitleScreenBackdrop() {
  return (
    <div className="title-stage" aria-hidden>
      <div className="title-stage__world">
        <CougarTerritoryScene />
        <AlpacaRanchScene />
        <div className="title-stage__blend" />
        <div className="title-stage__horizon" />
      </div>

      <div className="title-stage__grade title-stage__grade--bottom" />

      <div className="title-stage__rift-wrap">
        <div className="title-stage__rift-glow anim-rift-glow" />
        <div className="title-stage__rift anim-rift">
          <Image
            src="/assets/ui/rift-center.svg"
            alt=""
            width={64}
            height={900}
            className="title-stage__rift-img"
            unoptimized
          />
        </div>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={`ember-${i}`}
            className="anim-ember title-stage__ember"
            style={{
              left: `calc(50% + ${(i % 2 === 0 ? -1 : 1) * (4 + (i % 5) * 3)}px)`,
              bottom: `${8 + (i % 9) * 9}%`,
              animationDelay: `${i * 0.22}s`,
              animationDuration: `${2.2 + (i % 4) * 0.35}s`,
            }}
          />
        ))}
      </div>

      <div className="anim-cloud title-stage__cloud title-stage__cloud--a" />
      <div className="anim-cloud-slow title-stage__cloud title-stage__cloud--b" style={{ animationDelay: "-28s" }} />
      <div className="anim-cloud title-stage__cloud title-stage__cloud--c" style={{ animationDelay: "-12s" }} />
      <div className="anim-cloud-slow title-stage__cloud title-stage__cloud--d" style={{ animationDelay: "-40s" }} />

      {/* Sparks stay near rift / left — avoid milky haze over alpaca hooves */}
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={`spark-${i}`}
          className="anim-particle title-stage__spark"
          style={{
            left: `${6 + i * 4.2}%`,
            bottom: `${14 + (i % 5) * 8}%`,
            animationDelay: `${i * 0.24}s`,
            background: i % 3 === 0 ? "#f0c44a" : i % 3 === 1 ? "#ffe08a" : "#c8e8ff",
          }}
        />
      ))}
    </div>
  );
}
