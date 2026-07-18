"use client";

import Image from "next/image";

/**
 * Right-half title scene — mirrored from cougar side.
 * Uses standoff-style alpaca; solid FG (no translucent grass overlays).
 */
export function AlpacaRanchScene() {
  return (
    <div className="alpaca-scene">
      <div className="alpaca-scene__plate">
        <Image
          src="/assets/backgrounds/alpaca-ranch-world.png"
          alt=""
          fill
          priority
          sizes="55vw"
          className="alpaca-scene__plate-img"
          unoptimized
        />
      </div>

      <div className="alpaca-scene__grade alpaca-scene__grade--sky" />
      <div className="alpaca-scene__grade alpaca-scene__grade--ground" />

      <div className="alpaca-scene__hero">
        <div className="alpaca-scene__contact-shadow" />
        <Image
          src="/assets/characters/alpaca-hero-ranch.png"
          alt=""
          width={1024}
          height={1024}
          priority
          className="alpaca-scene__hero-img anim-idle-alpaca"
          unoptimized
        />
      </div>

      {/* Solid opaque ground strip — same treatment as cougar FG ledge */}
      <div className="alpaca-scene__fg">
        <Image
          src="/assets/ui/alpaca-fg-ledge.png"
          alt=""
          width={900}
          height={280}
          className="alpaca-scene__fg-ground"
          unoptimized
        />
      </div>

      <p className="alpaca-scene__label">
        ALPACA RANCH
        <span>SURVIVE. EXPLORE. EARN.</span>
      </p>
    </div>
  );
}
