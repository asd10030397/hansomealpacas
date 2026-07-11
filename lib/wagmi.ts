import { QueryClient } from "@tanstack/react-query";
import { createConfig, http, injected } from "wagmi";
import { robinhoodChain } from "@/lib/chain";

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [injected()],
  transports: {
    [robinhoodChain.id]: http(),
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
