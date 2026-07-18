"use client";

import { useEffect, useState } from "react";
import {
  PixelBadge,
  PixelButton,
  PixelPanel,
  PixelProgressBar,
} from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGenesisMint } from "@/hooks/game/useGenesisMint";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import {
  GENESIS_NFT_ADDRESS,
  getGenesisExplorerAddressUrl,
  getGenesisExplorerTxUrl,
} from "@/lib/game/genesis";

export function MintPanel() {
  const { t } = useGameI18n();
  const {
    wallet,
    connectWallet,
    switchToGenesisChain,
    isPending: walletPending,
  } = useWalletUi();
  const mint = useGenesisMint();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (mint.maxPublicQty > 0 && qty > mint.maxPublicQty) {
      setQty(mint.maxPublicQty);
    }
  }, [mint.maxPublicQty, qty]);

  if (!mint.configured) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-3 py-6">
        <p className="mock-chip">{t.mint.notConfigured}</p>
        <h1 className="pixel-title text-lg text-[#f0c44a]">{t.mint.mintPanel}</h1>
        <p className="text-sm text-[var(--hg-muted)]">{t.mint.blurb}</p>
      </div>
    );
  }

  if (mint.isLoading || !mint.sale) {
    return <p className="pixel-title text-xs px-3 py-6">{t.mint.loading}</p>;
  }

  const sale = mint.sale;
  const walletLabel = wallet.connected
    ? wallet.address ?? t.common.notConnected
    : t.common.notConnected;

  const phaseTone =
    sale.phase === "Public" || sale.phase === "Whitelist"
      ? "gold"
      : sale.phase === "SoldOut"
        ? "danger"
        : "blue";

  const canMintPublic =
    wallet.connected &&
    !wallet.wrongNetwork &&
    sale.phase === "Public" &&
    mint.maxPublicQty > 0 &&
    qty >= 1 &&
    qty <= mint.maxPublicQty;

  const canMintWl =
    wallet.connected &&
    !wallet.wrongNetwork &&
    mint.canWhitelistMint;

  const busy = mint.isPending || mint.isConfirming || walletPending;
  const errMsg =
    mint.writeError?.message ??
    mint.receiptError?.message ??
    mint.readError?.message ??
    null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6">
      <p className="mock-chip mock-chip--live">{t.mint.liveBanner}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">{sale.collectionName}</h1>
      <p className="text-sm text-[var(--hg-muted)]">{t.mint.blurb}</p>
      {GENESIS_NFT_ADDRESS ? (
        <p className="text-[10px] text-[var(--hg-muted)]">
          <a
            href={getGenesisExplorerAddressUrl(GENESIS_NFT_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[#f0c44a]/40 hover:text-[#f0c44a]"
          >
            {GENESIS_NFT_ADDRESS}
          </a>
        </p>
      ) : null}

      <PixelPanel title={t.mint.saleStatus}>
        <div className="mb-3 flex flex-wrap gap-2">
          <PixelBadge tone={phaseTone}>{sale.phase}</PixelBadge>
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
          <PixelButton
            variant="gold"
            onClick={connectWallet}
            className="mb-3"
            disabled={walletPending}
          >
            {t.common.connectWallet}
          </PixelButton>
        ) : wallet.wrongNetwork ? (
          <PixelButton
            variant="gold"
            onClick={switchToGenesisChain}
            className="mb-3"
            disabled={walletPending}
          >
            {t.mint.switchNetwork}
          </PixelButton>
        ) : null}

        {sale.phase === "Whitelist" ? (
          <div className="mb-3">
            <PixelButton
              variant="gold"
              size="lg"
              disabled={!canMintWl || busy}
              onClick={() => {
                mint.resetTx();
                mint.mintWhitelist();
              }}
            >
              {busy ? t.mint.minting : t.mint.mintWhitelist}
            </PixelButton>
          </div>
        ) : null}

        {sale.phase === "Public" ? (
          <>
            <label className="mb-2 block text-xs text-[var(--hg-muted)]" htmlFor="mint-qty">
              {t.mint.quantity}
              {mint.maxPublicQty > 0
                ? ` (max ${mint.maxPublicQty})`
                : ` — ${t.mint.walletCapReached}`}
            </label>
            <div className="mb-3 flex items-center gap-2">
              <PixelButton
                size="sm"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label={t.mint.decreaseAria}
                disabled={busy || mint.maxPublicQty < 1}
              >
                −
              </PixelButton>
              <input
                id="mint-qty"
                type="number"
                min={1}
                max={Math.max(1, mint.maxPublicQty)}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
                className="w-20 border-2 border-[#0d1018] bg-[#0d1018] px-2 py-2 text-center text-[#f3ebe0]"
                disabled={busy || mint.maxPublicQty < 1}
              />
              <PixelButton
                size="sm"
                onClick={() =>
                  setQty((q) => Math.min(Math.max(1, mint.maxPublicQty), q + 1))
                }
                aria-label={t.mint.increaseAria}
                disabled={busy || mint.maxPublicQty < 1}
              >
                +
              </PixelButton>
            </div>
            <PixelButton
              variant="gold"
              size="lg"
              disabled={!canMintPublic || busy}
              onClick={() => {
                mint.resetTx();
                mint.mintPublic(qty);
              }}
            >
              {busy ? t.mint.minting : t.mint.mintPublic}
            </PixelButton>
          </>
        ) : null}

        {sale.phase === "Upcoming" ? (
          <p className="text-xs text-[var(--hg-muted)]">{t.mint.saleUpcoming}</p>
        ) : null}
        {sale.phase === "SoldOut" ? (
          <p className="text-xs text-[#e07070]">{t.mint.soldOut}</p>
        ) : null}

        {mint.txHash ? (
          <p className="mt-3 text-xs text-[#8fd4a8]">
            {mint.isSuccess ? t.mint.mintSuccess : t.mint.txSubmitted}{" "}
            <a
              href={getGenesisExplorerTxUrl(mint.txHash)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {mint.txHash.slice(0, 10)}…
            </a>
          </p>
        ) : null}

        {errMsg ? (
          <p className="mt-3 text-xs text-[#e07070]" role="alert">
            {t.mint.mintError}: {shortErr(errMsg)}
          </p>
        ) : null}
      </PixelPanel>
    </div>
  );
}

function shortErr(msg: string): string {
  const line = msg.split("\n")[0] ?? msg;
  return line.length > 180 ? `${line.slice(0, 180)}…` : line;
}
