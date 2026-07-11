import type { OfficialWallet } from "@/content/transparency";
import { CopyAddressButton } from "@/components/transparency/CopyAddressButton";

type WalletCardProps = {
  wallet: OfficialWallet;
};

export function WalletCard({ wallet }: WalletCardProps) {
  return (
    <article className="gold-border rounded-2xl p-6 text-left sm:p-8">
      <header className="border-b border-border/50 pb-5">
        <p className="text-xs uppercase tracking-[0.28em] text-gold-light">Official Wallet</p>
        <h2 className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.08em] text-gold-light sm:text-3xl">
          <span aria-hidden="true" className="mr-2">
            {wallet.emoji}
          </span>
          {wallet.title}
        </h2>
      </header>

      <dl className="mt-6 space-y-5 text-sm sm:text-base">
        <div>
          <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">Purpose</dt>
          <dd className="mt-2 leading-relaxed text-foreground/90">{wallet.purpose}</dd>
        </div>

        {wallet.liquidityDetail ? (
          <div>
            <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">Liquidity Position</dt>
            <dd className="mt-2 text-foreground/90">{wallet.liquidityDetail}</dd>
          </div>
        ) : null}

        <div>
          <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">Allocation</dt>
          <dd className="mt-2 font-medium tabular-nums text-foreground">{wallet.allocation}</dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">Address</dt>
          <dd className="mt-2 break-all rounded-xl border border-wood/40 bg-wood/10 px-4 py-3 font-mono text-xs text-gold-light/90 sm:text-sm">
            {wallet.address}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <CopyAddressButton address={wallet.address} />
        <a
          href={wallet.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center border border-border px-6 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.16em] text-foreground transition-all hover:border-gold/35 sm:text-sm"
        >
          View on Blockscout
        </a>
      </div>

      {wallet.note ? (
        <p className="mt-5 border-t border-border/60 pt-5 text-sm leading-relaxed text-muted">{wallet.note}</p>
      ) : null}
    </article>
  );
}
