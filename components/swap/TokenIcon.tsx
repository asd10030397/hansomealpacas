import Image from "next/image";
import { ASSETS } from "@/content/project";

type TokenIconProps = {
  symbol: "ETH" | "UGLY";
  size?: number;
  className?: string;
};

export function TokenIcon({ symbol, size = 40, className = "" }: TokenIconProps) {
  if (symbol === "UGLY") {
    return (
      <Image
        src={ASSETS.logo}
        alt="UGLY"
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        priority
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full border border-border bg-white/[0.04] font-[family-name:var(--font-anton)] text-[0.65rem] tracking-wider text-gold-light ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      ETH
    </div>
  );
}
