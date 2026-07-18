export function PixelProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1 flex justify-between text-xs text-[var(--hg-muted)]">
          <span>{label}</span>
          <span>
            {value} / {max}
          </span>
        </div>
      ) : null}
      <div className="h-4 border-2 border-[#0d1018] bg-[#0d1018] p-0.5 shadow-[2px_2px_0_#0d1018]">
        <div
          className="h-full bg-[linear-gradient(90deg,#e8b03a,#f0c44a)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
