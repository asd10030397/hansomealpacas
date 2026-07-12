"use client";

import type { OfficialWallet } from "@/content/transparency";
import { WalletCard } from "@/components/transparency/WalletCard";
import { useWalletBalances } from "@/hooks/useWalletBalances";

type OfficialWalletsGridProps = {
  wallets: readonly OfficialWallet[];
};

export function OfficialWalletsGrid({ wallets }: OfficialWalletsGridProps) {
  const { data, isLoading, hasError } = useWalletBalances();

  return (
    <div className="mt-14 grid w-full grid-cols-1 gap-6">
      {wallets.map((wallet) => {
        const live = data?.balances.find((balance) => balance.id === wallet.id);
        return (
          <WalletCard
            key={wallet.id}
            wallet={wallet}
            liveBalance={live?.hansome}
            isLoadingLiveBalance={isLoading && !data}
            hasLiveBalanceError={hasError && !data}
          />
        );
      })}
    </div>
  );
}
