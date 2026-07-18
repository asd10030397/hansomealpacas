"use client";

import Image from "next/image";

export function CharacterSilhouettes() {
  return (
    <>
      <div className="anim-idle pointer-events-none absolute bottom-20 left-2 z-[1] w-16 opacity-95 sm:bottom-16 sm:left-4 sm:w-28 lg:left-10 lg:w-40">
        <Image
          src="/assets/characters/cougar-placeholder.svg"
          alt=""
          width={160}
          height={160}
          className="pixelated drop-shadow-[4px_4px_0_#0a0c12]"
          unoptimized
        />
      </div>
      <div
        className="anim-idle pointer-events-none absolute bottom-20 right-2 z-[1] w-16 opacity-95 sm:bottom-16 sm:right-4 sm:w-28 lg:right-10 lg:w-40"
        style={{ animationDelay: "0.6s" }}
      >
        <Image
          src="/assets/characters/alpaca-placeholder.svg"
          alt=""
          width={160}
          height={160}
          className="pixelated drop-shadow-[4px_4px_0_#0a0c12]"
          unoptimized
        />
      </div>
    </>
  );
}
