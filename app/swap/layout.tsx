import type { Metadata } from "next";
import { Web3Provider } from "@/components/Web3Provider";
import { WalletConnectProvider } from "@/context/WalletConnectContext";
import { PROJECT } from "@/content/project";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chain";

export const metadata: Metadata = {
  title: `Swap ${PROJECT.symbol} | ${PROJECT.name}`,
  description: `Swap ETH and $${PROJECT.symbol} on Robinhood Chain via Uniswap Universal Router.`,
};

export default function SwapLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      <WalletConnectProvider chainId={ROBINHOOD_CHAIN_ID}>{children}</WalletConnectProvider>
    </Web3Provider>
  );
}
