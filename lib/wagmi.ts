import { QueryClient } from "@tanstack/react-query";
import { createConfig, http, injected } from "wagmi";
import { robinhoodChain, robinhoodTestnetChain } from "@/lib/chain";

export const wagmiConfig = createConfig({
  chains: [robinhoodChain, robinhoodTestnetChain],
  connectors: [injected()],
  transports: {
    [robinhoodChain.id]: http(),
    [robinhoodTestnetChain.id]: http(
      process.env.NEXT_PUBLIC_GAME_RPC_URL?.trim() || undefined,
    ),
  },
  ssr: true,
});

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
