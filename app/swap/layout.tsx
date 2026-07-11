import type { Metadata } from "next";
import { Web3Provider } from "@/components/Web3Provider";
import { PROJECT } from "@/content/project";

export const metadata: Metadata = {
  title: `Swap ${PROJECT.symbol} | ${PROJECT.name}`,
  description: `Swap ETH and $${PROJECT.symbol} on Robinhood Chain via Uniswap Universal Router.`,
};

export default function SwapLayout({ children }: { children: React.ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
