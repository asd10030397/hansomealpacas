"use client";

type SparklineProps = {
  points: { ts: number; priceUsd: number }[];
  className?: string;
};

export function Sparkline({ points, className = "" }: SparklineProps) {
  if (points.length < 2) {
    return (
      <div
        className={`flex h-16 items-center justify-center rounded-xl border border-wood/40 bg-wood/5 text-xs text-muted ${className}`}
        aria-hidden="true"
      >
        —
      </div>
    );
  }

  const width = 320;
  const height = 64;
  const padding = 4;

  const prices = points.map((point) => point.priceUsd);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || max * 0.01 || 1;

  const coords = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (point.priceUsd - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x},${coord.y}`).join(" ");
  const areaPath = `${linePath} L${coords.at(-1)!.x},${height - padding} L${coords[0]!.x},${height - padding} Z`;

  const trendUp = prices.at(-1)! >= prices[0]!;
  const stroke = trendUp ? "#4ade80" : "#f87171";
  const fill = trendUp ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-16 w-full ${className}`}
      role="img"
      aria-label="Price sparkline"
      preserveAspectRatio="none"
    >
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
