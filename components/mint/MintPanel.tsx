"use client";

import { useEffect, useState } from "react";
import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import {
  PixelBadge,
  PixelButton,
  PixelPanel,
  PixelProgressBar,
} from "@/components/ui/pixel";
import { fetchMintSaleState } from "@/lib/game/mintService";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import type { MintSaleState } from "@/types/game";

export function MintPanel() {
  const { t } = useGameI18n();
  const { wallet, connectMock } = useWalletUi();
  const [sale, setSale] = useState<MintSaleState | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    void fetchMintSaleState().then(setSale);
  }, []);

  if (!sale) {
    return <p className="pixel-title text-xs">{t.mint.loading}</p>;
  }

  const walletLabel = wallet.connected
    ? wallet.address ?? t.common.notConnected
    : t.common.notConnected;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6">
      <p className="mock-chip">{t.common.demoBanner}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">{sale.collectionName}</h1>
      <p className="text-sm text-[var(--hg-muted)]">{t.mint.blurb}</p>

      <PixelPanel title={t.mint.saleStatus}>
        <div className="mb-3 flex flex-wrap gap-2">
          <PixelBadge tone="gold">{sale.phase}</PixelBadge>
          <PixelBadge tone="blue">Royalty {sale.royaltyBps / 100}%</PixelBadge>
        </div>
        <PixelProgressBar
          value={sale.minted}
          max={sale.totalSupply}
          label={t.mint.mintedLabel}
        />
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.supply}</dt>
            <dd>{sale.totalSupply}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.alpacas}</dt>
            <dd>{sale.alpacaCount}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.cougars}</dt>
            <dd>{sale.cougarCount}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.reserved}</dt>
            <dd>
              #{String(1).padStart(3, "0")}–#{String(sale.reservedCount).padStart(3, "0")}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.whitelist}</dt>
            <dd>
              {sale.whitelistCap} · max {sale.wlWalletMax}/wallet · −1h
            </dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.public}</dt>
            <dd>
              {sale.publicCap} · max {sale.publicWalletMax}/wallet
            </dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.walletMax}</dt>
            <dd>{sale.combinedWalletMax} combined</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.price}</dt>
            <dd className="text-[#f0c44a]">{sale.mintPriceLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">{t.mint.wlEligibility}</dt>
            <dd>
              {sale.whitelistEligible === null
                ? t.mint.wlUnknown
                : sale.whitelistEligible
                  ? t.mint.yes
                  : t.mint.no}
            </dd>
          </div>
        </dl>
      </PixelPanel>

      <PixelPanel title={t.mint.mintPanel} eyebrow={t.mint.mintEyebrow}>
        <p className="mb-3 text-xs text-[var(--hg-muted)]">
          {t.mint.walletLine(walletLabel, wallet.networkLabel)}
        </p>
        {!wallet.connected ? (
          <PixelButton variant="gold" onClick={connectMock} className="mb-3">
            {t.common.connectWalletMock}
          </PixelButton>
        ) : null}
        <label className="mb-2 block text-xs text-[var(--hg-muted)]" htmlFor="mint-qty">
          {t.mint.quantity}
        </label>
        <div className="mb-3 flex items-center gap-2">
          <PixelButton
            size="sm"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label={t.mint.decreaseAria}
          >
            −
          </PixelButton>
          <input
            id="mint-qty"
            type="number"
            min={1}
            max={sale.publicWalletMax}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value) || 1)}
            className="w-20 border-2 border-[#0d1018] bg-[#0d1018] px-2 py-2 text-center text-[#f3ebe0]"
          />
          <PixelButton
            size="sm"
            onClick={() => setQty((q) => Math.min(sale.publicWalletMax, q + 1))}
            aria-label={t.mint.increaseAria}
          >
            +
          </PixelButton>
        </div>
        <ComingSoonButton feature={t.features.genesisMint} variant="gold" size="lg">
          {t.mint.mintPanel}
        </ComingSoonButton>
      </PixelPanel>
    </div>
  );
}
