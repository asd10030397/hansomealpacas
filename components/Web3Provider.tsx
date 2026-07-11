"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { createQueryClient, wagmiConfig } from "@/lib/wagmi";

type Web3ProviderProps = {
  children: React.ReactNode;
};

export function Web3Provider({ children }: Web3ProviderProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
