import type { ReactNode } from "react";

export type GameFeedbackTone = "pending" | "success" | "error" | "info";

const LABELS: Record<GameFeedbackTone, string> = {
  pending: "Pending",
  success: "Success",
  error: "Error",
  info: "Info",
};

/** Inline transaction / status feedback — game-styled, no toast library. */
export function GameFeedback({
  tone,
  label,
  children,
  meta,
  prominent,
}: {
  tone: GameFeedbackTone;
  label?: string;
  children?: ReactNode;
  meta?: ReactNode;
  /** Larger callout for player guidance (e.g. don't wait on timer). */
  prominent?: boolean;
}) {
  const role = tone === "error" ? "alert" : "status";
  return (
    <div
      className={`hg-feedback hg-feedback--${tone}${prominent ? " hg-feedback--prominent" : ""}`}
      role={role}
      aria-live="polite"
    >
      <p className="hg-feedback__label">{label ?? LABELS[tone]}</p>
      {children ? <div className="hg-feedback__body">{children}</div> : null}
      {meta ? <div className="hg-feedback__meta">{meta}</div> : null}
    </div>
  );
}

export function GameEmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="hg-empty" role="status">
      <p className="hg-empty__title">{title}</p>
      <div className="hg-empty__body">{children}</div>
    </div>
  );
}

export function GameSkeleton({
  rows = 3,
  cards = 0,
}: {
  rows?: number;
  cards?: number;
}) {
  return (
    <div className="hg-skeleton" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={`line-${i}`}
          className={`hg-skeleton__line ${
            i === 0 ? "hg-skeleton__line--lg" : i === 1 ? "hg-skeleton__line--md" : "hg-skeleton__line--sm"
          }`}
        />
      ))}
      {Array.from({ length: cards }, (_, i) => (
        <div key={`card-${i}`} className="hg-skeleton__card" />
      ))}
    </div>
  );
}
