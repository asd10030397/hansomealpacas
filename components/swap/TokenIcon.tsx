import Image from "next/image";
import { ASSETS, PROJECT } from "@/content/project";

type TokenIconProps = {
  symbol: "ETH" | typeof PROJECT.symbol;
  size?: number;
  className?: string;
};

export function TokenIcon({ symbol, size = 40, className = "" }: TokenIconProps) {
  if (symbol === PROJECT.symbol) {
    return (
      <Image
        src={ASSETS.logo}
        alt={PROJECT.symbol}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        priority
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 border-wood bg-surface font-[family-name:var(--font-anton)] text-[0.65rem] tracking-wider text-gold-light ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      ETH
    </div>
  );
}
