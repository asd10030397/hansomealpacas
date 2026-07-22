"use client";

import Image from "next/image";
import "@/styles/launch-end-card.css";

export type LaunchEndCardProps = {
  /** When true, fills the viewport for trailer / fullscreen capture. */
  fullscreen?: boolean;
};

/**
 * Launch end card — mint CTA composition for marketing / trailer close.
 * Presentation only; does not mint or change on-chain state.
 */
export function LaunchEndCard({ fullscreen = false }: LaunchEndCardProps) {
  return (
    <section
      className={`launch-end${fullscreen ? " launch-end--fullscreen" : ""}`}
      data-testid="launch-end-card"
      aria-label="HANSOME Genesis launch"
    >
      <Image
        src="/logo/logo-512.png"
        alt="HANSOME"
        width={128}
        height={128}
        className="launch-end__logo"
        unoptimized
      />
      <p className="launch-end__eyebrow">HANSOME · Alpacas vs Cougars</p>
      <h1 className="launch-end__title">Coming Soon</h1>
      <dl className="launch-end__facts">
        <div>
          <dt>Mint</dt>
          <dd>July 24, 2026</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>0.015 ETH</dd>
        </div>
        <div>
          <dt>Chain</dt>
          <dd>Robinhood Chain</dd>
        </div>
      </dl>
      <p className="launch-end__url">https://game.hansomealpacas.xyz/</p>
      <p className="launch-end__social">
        X @HansomeAlpacas · Telegram t.me/hansomealpacas
      </p>
      <p className="launch-end__tag">Choose. Survive. Earn.</p>
    </section>
  );
}
