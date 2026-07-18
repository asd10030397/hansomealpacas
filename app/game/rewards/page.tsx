"use client";

import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { PixelPanel } from "@/components/ui/pixel";
import { MOCK_BANNER, MOCK_REWARDS } from "@/data/game/mock";

export default function RewardsPage() {
  const r = MOCK_REWARDS;
  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <p className="mock-chip mb-3">{MOCK_BANNER}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">REWARDS</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">
        Claimable balances follow the NFT. Values below are mock only — not live chain reads.
      </p>

      <PixelPanel className="mt-4" title="BALANCES" eyebrow="MOCK HANSOME">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[var(--hg-muted)]">Total pending</dt>
            <dd className="pixel-title text-[#f0c44a]">{r.totalPending}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Claimable</dt>
            <dd className="pixel-title text-[#f0c44a]">{r.claimable}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Already claimed</dt>
            <dd>{r.alreadyClaimed}</dd>
          </div>
          <div>
            <dt className="text-[var(--hg-muted)]">Current day</dt>
            <dd>{r.currentDayRewards}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[var(--hg-muted)]">Treasury availability</dt>
            <dd>{r.treasuryAvailability} (placeholder)</dd>
          </div>
        </dl>
        <div className="mt-4">
          <ComingSoonButton feature="Claim" variant="green" size="lg">
            CLAIM
          </ComingSoonButton>
        </div>
        <p className="mt-2 text-xs text-[var(--hg-muted)]">
          TODO(contract): replace Coming Soon with RewardDistributor.claim.
        </p>
      </PixelPanel>

      <PixelPanel className="mt-4" title="HISTORY">
        <ul className="space-y-2 text-sm">
          {r.history.map((h, i) => (
            <li key={i} className="flex justify-between gap-3 border-b border-[#2a3348] py-2">
              <span>
                Day {h.day} · {h.side}
                <span className="mt-1 block text-xs text-[var(--hg-muted)]">{h.note}</span>
              </span>
              <span className="text-[#f0c44a]">{h.amount}</span>
            </li>
          ))}
        </ul>
      </PixelPanel>
    </div>
  );
}
