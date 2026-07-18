import Image from "next/image";

/** Dominant pixel game logo plate — title-screen brand, not nav text. */
export function GameTitleLogo() {
  return (
    <div className="game-logo" aria-label="HANSOME ALPACAS">
      <p className="game-logo__eyebrow">MAIN MENU</p>

      <div className="game-logo__plate">
        <span className="game-logo__plate-shine" aria-hidden />
        <span className="game-logo__jewel game-logo__jewel--tl" aria-hidden />
        <span className="game-logo__jewel game-logo__jewel--tr" aria-hidden />
        <span className="game-logo__jewel game-logo__jewel--bl" aria-hidden />
        <span className="game-logo__jewel game-logo__jewel--br" aria-hidden />

        <div className="game-logo__mark" aria-hidden>
          <span className="game-logo__paw" />
          <Image
            src="/assets/ui/logo-hansome-game.svg"
            alt=""
            width={64}
            height={28}
            className="game-logo__crest-img"
            unoptimized
            priority
          />
          <span className="game-logo__wool" />
        </div>

        <h1 className="game-logo__title">
          <span className="game-logo__line game-logo__line--top" data-text="HANSOME">
            HANSOME
          </span>
          <span className="game-logo__line game-logo__line--bottom" data-text="ALPACAS">
            ALPACAS
          </span>
        </h1>

        <div className="game-logo__divider" aria-hidden />
        <p className="game-logo__sub">ALPACAS VS COUGARS</p>
      </div>
    </div>
  );
}
