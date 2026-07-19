"use client";

import { useMemo, useState } from "react";
import { NFTCard } from "@/components/nft/NFTCard";
import { PixelButton } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";
import { useWalletUi } from "@/hooks/game/useWalletUi";

type Filter = "all" | "alpacas" | "cougars" | "revealed" | "unrevealed";

export default function MyNftsPage() {
  const { t } = useGameI18n();
  const { wallet, connectWallet, switchToGenesisChain, isPending } = useWalletUi();
  const { nfts, isLoading, isConnected, configured, balance, error, refetch } =
    useOwnedGenesisNfts();
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo(() => {
    return nfts.filter((n) => {
      if (filter === "alpacas") return n.side === "Alpaca";
      if (filter === "cougars") return n.side === "Cougar";
      if (filter === "revealed") return n.revealed;
      if (filter === "unrevealed") return !n.revealed;
      return true;
    });
  }, [filter, nfts]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "ALL" },
    { id: "alpacas", label: "ALPACAS" },
    { id: "cougars", label: "COUGARS" },
    { id: "revealed", label: "REVEALED" },
    { id: "unrevealed", label: "UNREVEALED" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-3 py-6">
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.myNfts.heading}</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.myNfts.blurb}</p>

      {!configured ? (
        <p className="mt-6 rounded border border-[#5a4630] bg-[#1a1410]/90 px-3 py-3 text-sm text-[#f0c44a]">
          Genesis NFT address is not configured.
        </p>
      ) : !isConnected ? (
        <div className="my-nfts-wallet-panel mt-6 space-y-3 rounded border border-[#2a3348] bg-[#141a26]/88 px-3 py-4">
          <p className="text-sm text-[var(--hg-muted)]">
            Connect a wallet on Robinhood Testnet to load your live inventory.
          </p>
          <PixelButton
            size="sm"
            variant="gold"
            onClick={connectWallet}
            disabled={isPending}
            data-wallet-entry="my-nfts"
          >
            CONNECT WALLET
          </PixelButton>
        </div>
      ) : wallet.wrongNetwork ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-[#e07070]">Wrong network. Switch to Robinhood Testnet.</p>
          <PixelButton
            size="sm"
            variant="gold"
            onClick={switchToGenesisChain}
            disabled={isPending}
          >
            SWITCH NETWORK
          </PixelButton>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--hg-muted)]">
            <span>
              Owned: <span className="text-[#f3ebe0]">{balance}</span>
            </span>
            <PixelButton size="sm" variant="slate" onClick={() => void refetch()}>
              REFRESH
            </PixelButton>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <PixelButton
                key={f.id}
                size="sm"
                variant={filter === f.id ? "gold" : "slate"}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </PixelButton>
            ))}
          </div>

          {isLoading ? (
            <p className="mt-8 text-sm text-[var(--hg-muted)]">Loading on-chain inventory…</p>
          ) : error ? (
            <p className="mt-8 text-sm text-[#e07070]">{error}</p>
          ) : items.length === 0 ? (
            <p className="mt-8 text-sm text-[var(--hg-muted)]">
              No Genesis NFTs in this wallet. Mint on the Mint page, then refresh.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((nft) => (
                <NFTCard key={nft.tokenId} nft={nft} live />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
