"use client";

import { useEffect, useState } from "react";
import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import {
  PixelBadge,
  PixelButton,
  PixelPanel,
  PixelProgressBar,
} from "@/components/ui/pixel";
import { MOCK_BANNER } from "@/data/game/mock";
import { fetchMintSaleState } from "@/lib/game/mintService";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import type { MintSaleState } from "@/types/game";

export function MintPanel() {
  const { wallet, connectMock } = useWalletUi();
  const [sale, setSale] = useState<MintSaleState | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    void fetchMintSaleState().then(setSale);
  }, []);

  if (!sale) {
    return <p className="pixel-title text-xs">Loading mint state…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6">
      <p className="mock-chip">{MOCK_BANNER}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">{sale.collectionName}</h1>
      <p className="text-sm text-[var(--hg-muted)]">
        One unified mint. You cannot choose Alpaca or Cougar — side is revealed later.
      </p>

      <PixelPanel title="SALE STATUS">
        <div className="mb-3 flex flex-wrap gap-2">
          <PixelBadge tone="gold">{sale.phase}</PixelBadge>
          <PixelBadge tone="blue">Royalty {sale.royaltyBps / 100}%</PixelBadge>
        </div>
        <PixelProgressBar value={sale.minted} max={sale.totalSupply} label="Minted / Total" />
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[var(--hg-muted)]">Supply</dt>
            <dd>{sale.totalSupply}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Alpacas</dt>
            <dd>{sale.alpacaCount}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Cougars</dt>
            <dd>{sale.cougarCount}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Reserved</dt>
            <dd>#{String(1).padStart(3, "0")}–#{String(sale.reservedCount).padStart(3, "0")}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Whitelist</dt>
            <dd>{sale.whitelistCap} · max {sale.wlWalletMax}/wallet · −1h</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Public</dt>
            <dd>{sale.publicCap} · max {sale.publicWalletMax}/wallet</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Wallet max</dt>
            <dd>{sale.combinedWalletMax} combined</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Price</dt>
            <dd className="text-[#f0c44a]">{sale.mintPriceLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">WL eligibility</dt>
            <dd>{sale.whitelistEligible === null ? "Unknown (mock)" : sale.whitelistEligible ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </PixelPanel>

      <PixelPanel title="MINT" eyebrow="NO TX SENT">
        <p className="mb-3 text-xs text-[var(--hg-muted)]">
          Wallet: {wallet.connected ? wallet.address : "Not connected"} · {wallet.networkLabel}
        </p>
        {!wallet.connected ? (
          <PixelButton variant="gold" onClick={connectMock} className="mb-3">
            CONNECT WALLET (MOCK)
          </PixelButton>
        ) : null}
        <label className="mb-2 block text-xs text-[var(--hg-muted)]" htmlFor="mint-qty">
          Quantity
        </label>
        <div className="mb-3 flex items-center gap-2">
          <PixelButton size="sm" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
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
            aria-label="Increase"
          >
            +
          </PixelButton>
        </div>
        <ComingSoonButton feature="Genesis Mint" variant="gold" size="lg">
          MINT
        </ComingSoonButton>
        <p className="mt-3 text-xs text-[var(--hg-muted)]">
          Quantity selector ({qty}) is UI-only until the contract is wired.
        </p>
      </PixelPanel>

      <PixelPanel title="REVEAL">
        <p className="text-sm text-[var(--hg-muted)]">
          Sale NFTs mint opaque. Side (Alpaca / Cougar) and gameplay class are assigned at
          collection reveal — not at purchase. Reserved Specials #001–#010 are Alpacas.
        </p>
        <p className="mt-2 text-xs text-[var(--hg-muted)]">
          TODO(contract): wire HansomeGenesisNFT — do not invent addresses.
        </p>
      </PixelPanel>
    </div>
  );
}
