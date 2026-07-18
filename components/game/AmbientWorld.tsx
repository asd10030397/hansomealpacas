"use client";

/** Full-bleed split world — left/right on all viewports (not marketing sky). */
export function AmbientWorld() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Left — Cougar Territory */}
      <div className="absolute inset-y-0 left-0 w-1/2">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0f1628_0%,#1c2740_40%,#2a3348_70%,#3a2a22_100%)]" />
        <div className="absolute inset-x-0 bottom-[28%] h-[22%] bg-[linear-gradient(180deg,transparent,#1a2820)] opacity-80" />
        <div className="absolute bottom-0 left-0 right-0 h-[18%] bg-[repeating-linear-gradient(90deg,#2a2218_0_10px,#3a2e20_10px_20px)] opacity-90" />
        <div className="anim-grass absolute bottom-0 left-0 right-0 h-8 bg-[repeating-linear-gradient(90deg,#3a2a20_0_8px,#4a3828_8px_16px)] opacity-70" />
        <div className="absolute bottom-[30%] left-[6%] h-12 w-14 bg-[#151c2c] [clip-path:polygon(50%_0,100%_100%,0_100%)] opacity-90 sm:h-16 sm:w-20" />
        <div className="absolute bottom-[30%] left-[32%] h-16 w-20 bg-[#121820] [clip-path:polygon(50%_0,100%_100%,0_100%)] sm:h-24 sm:w-28" />
      </div>

      {/* Right — Alpaca Ranch */}
      <div className="absolute inset-y-0 right-0 w-1/2">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#3a8ec8_0%,#6eb8e0_38%,#7ec45a_65%,#c8e07a_100%)]" />
        <div className="anim-rays absolute inset-0 opacity-40" />
        <div className="anim-grass absolute bottom-0 left-0 right-0 h-10 bg-[repeating-linear-gradient(90deg,#3f8a34_0_8px,#57a844_8px_16px)] opacity-85" />
        <div className="absolute bottom-[12%] left-[12%] h-8 w-1.5 bg-[#6b4423] sm:h-10 sm:w-2" />
        <div className="absolute bottom-[12%] left-[22%] h-8 w-1.5 bg-[#6b4423] sm:h-10 sm:w-2" />
        <div className="absolute bottom-[12%] left-[32%] h-8 w-1.5 bg-[#6b4423] sm:h-10 sm:w-2" />
        <div className="absolute bottom-[18%] left-[12%] h-1 w-[28%] bg-[#8b5a2b]" />
      </div>

      {/* Center rift */}
      <div className="anim-rift absolute left-1/2 top-0 z-[1] h-full w-2 -translate-x-1/2 bg-[linear-gradient(180deg,#f4d06a,#ff8a3a,#f4d06a)] shadow-[0_0_20px_#f4d06a] sm:w-3 sm:shadow-[0_0_28px_#f4d06a]" />

      {/* Clouds */}
      <div className="anim-cloud absolute top-8 z-[1] h-3 w-12 bg-white/20 sm:top-12 sm:h-4 sm:w-20" />
      <div
        className="anim-cloud-slow absolute top-14 z-[1] h-3 w-10 bg-white/25 left-[52%]"
        style={{ animationDelay: "-22s" }}
      />

      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="anim-particle absolute z-[1] h-1 w-1 bg-[#f0c44a]"
          style={{
            left: `${8 + i * 9}%`,
            bottom: `${20 + (i % 4) * 7}%`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}

      <p className="pixel-title-display pixel-title absolute left-2 top-[18%] z-[2] max-w-[5.5rem] text-left text-[0.42rem] leading-relaxed text-[#c4894a] sm:left-3 sm:top-[22%] sm:max-w-[9rem] sm:text-[0.55rem] lg:left-6 lg:text-[0.65rem]">
        COUGAR
        <br />
        TERRITORY
        <span className="mt-1 hidden font-[family-name:var(--font-body)] text-[0.65rem] tracking-normal text-[#a89880] sm:mt-2 sm:block sm:text-[0.7rem]">
          HUNT. STRATEGIZE. EARN.
        </span>
      </p>
      <p className="pixel-title-display pixel-title absolute right-2 top-[18%] z-[2] max-w-[5.5rem] text-right text-[0.42rem] leading-relaxed text-[#f0d9a0] sm:right-3 sm:top-[22%] sm:max-w-[9rem] sm:text-[0.55rem] lg:right-6 lg:text-[0.65rem]">
        ALPACA
        <br />
        RANCH
        <span className="mt-1 hidden font-[family-name:var(--font-body)] text-[0.65rem] tracking-normal text-[#e8f0d8] sm:mt-2 sm:block sm:text-[0.7rem]">
          SURVIVE. EXPLORE. EARN.
        </span>
      </p>
    </div>
  );
}
