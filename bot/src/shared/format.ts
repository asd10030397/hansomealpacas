/**
 * Mirrors lib/market/format.ts from the website (verbatim logic).
 *
 * The bot is a fully standalone module with its own package.json/build, so
 * this file is copied rather than imported across the package boundary —
 * that avoids coupling the bot's build/runtime to the website's tsconfig
 * path aliases and dependency tree. If lib/market/format.ts ever changes,
 * update this copy to match.
 */

export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  return `$${value.toExponential(2)}`;
}

export function formatEth(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 0.000001) return `${value.toExponential(2)} ETH`;
  if (value < 0.001) return `${value.toFixed(8)} ETH`;
  return `${value.toFixed(6)} ETH`;
}

export function formatCompact(value: number, suffix = ""): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B${suffix}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M${suffix}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K${suffix}`;
  return `${value.toFixed(2)}${suffix}`;
}

export function formatTokenAmount(value: number, symbol = ""): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value).toLocaleString("en-US");
  return symbol ? `${rounded} ${symbol}` : rounded;
}

export function formatPercentChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
