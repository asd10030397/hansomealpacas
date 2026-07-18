"use client";

import Image from "next/image";

/**
 * Left-half title scene — composed as one wilderness stage
 * (sky → mountains → pine forest → rocky ground → hero → FG),
 * not a corner-pinned sprite on a zoomed plate.
 */
export function CougarTerritoryScene() {
  return (
    <div className="cougar-scene">
      {/* Continuous landscape plate — native density, no blocky upscale */}
      <div className="cougar-scene__plate">
        <Image
          src="/assets/backgrounds/standoff-world.png"
          alt=""
          fill
          priority
          sizes="55vw"
          className="cougar-scene__plate-img"
          unoptimized
        />
      </div>

      {/* Depth grades — cold wilderness, keep mountains readable up top */}
      <div className="cougar-scene__grade cougar-scene__grade--sky" />
      <div className="cougar-scene__grade cougar-scene__grade--ground" />

      {/* Soft mist over forest band */}
      <div className="cougar-scene__mist anim-mist" />
      <div className="cougar-scene__mist cougar-scene__mist--low anim-mist-slow" />

      {/* Hero stage — mid-lower left half with breathing room */}
      <div className="cougar-scene__hero">
        <div className="cougar-scene__contact-shadow" />
        <Image
          src="/assets/characters/cougar-hero-standoff.png"
          alt=""
          width={1024}
          height={1024}
          priority
          className="cougar-scene__hero-img anim-idle-cougar"
          unoptimized
        />
      </div>

      {/* Foreground ledge cut from the same landscape — integrates hero into the scene */}
      <div className="cougar-scene__fg">
        <Image
          src="/assets/ui/cougar-fg-ledge.png"
          alt=""
          width={900}
          height={244}
          className="cougar-scene__fg-rocks"
          unoptimized
        />
        <Image
          src="/assets/ui/cougar-fg-bush.svg"
          alt=""
          width={96}
          height={80}
          className="cougar-scene__fg-bush cougar-scene__fg-bush--a anim-grass"
          unoptimized
        />
        <Image
          src="/assets/ui/cougar-fg-bush.svg"
          alt=""
          width={80}
          height={66}
          className="cougar-scene__fg-bush cougar-scene__fg-bush--b anim-grass"
          style={{ animationDelay: "0.5s" }}
          unoptimized
        />
      </div>

      <p className="cougar-scene__label">
        COUGAR TERRITORY
        <span>HUNT. STRATEGIZE. EARN.</span>
      </p>
    </div>
  );
}
