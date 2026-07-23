"use client";

import { useEffect, useMemo, useState } from "react";
import { zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { PixelCountdown } from "@/components/ui/pixel";
import { hansomeGenesisNftAbi } from "@/lib/game/abis/hansomeGenesisNft";
import { GENESIS_CHAIN_ID, GENESIS_NFT_ADDRESS } from "@/lib/game/genesis";
import type { Locale } from "@/content/i18n/types";

type Props = {
  label: string;
  opensAt: (when: string) => string;
  locale: Locale;
};

export function MintOpeningCountdown({ label, opensAt, locale }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: whitelistStart } = useReadContract({
    address: GENESIS_NFT_ADDRESS ?? zeroAddress,
    abi: hansomeGenesisNftAbi,
    functionName: "whitelistStart",
    chainId: GENESIS_CHAIN_ID,
    query: { enabled: GENESIS_NFT_ADDRESS != null },
  });

  const startSec = whitelistStart != null ? Number(whitelistStart) : 0;
  const endsAtMs = startSec > 0 ? startSec * 1000 : 0;

  const whenLabel = useMemo(() => {
    if (endsAtMs <= 0) return null;
    const when = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(endsAtMs));
    return opensAt(when);
  }, [endsAtMs, locale, opensAt]);

  if (endsAtMs <= 0 || endsAtMs <= now) return null;

  return (
    <div className="mb-3 space-y-2">
      <PixelCountdown endsAt={endsAtMs} now={now} label={label} />
      {whenLabel ? (
        <p className="text-[10px] text-[var(--hg-muted)]">{whenLabel}</p>
      ) : null}
    </div>
  );
}
