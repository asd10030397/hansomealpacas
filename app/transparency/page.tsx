import Link from "next/link";
import { OfficialWalletsGrid } from "@/components/transparency/OfficialWalletsGrid";
import { FooterSection } from "@/sections/FooterSection";
import { OFFICIAL_WALLETS, TOKEN_ALLOCATION } from "@/content/transparency";
import { PROJECT } from "@/content/project";

export const metadata = {
  title: "Official Wallets | HANSOME ALPACAS",
  description:
    "Official HANSOME wallets, treasury allocation, founder wallet, and liquidity wallet.",
};

export default function TransparencyPage() {
  return (
    <>
      <main id="main-content" className="relative min-h-screen overflow-x-hidden px-6 pb-12 pt-16">
        <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />

        <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-col py-12 text-center">
          <Link
            href="/"
            className="mb-10 self-center font-[family-name:var(--font-anton)] text-xs tracking-[0.28em] text-muted transition-colors hover:text-gold-light"
          >
            ← HOME
          </Link>

          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold-light sm:text-sm">
            TRANSPARENCY
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2rem,7vw,4rem)] tracking-[0.08em] text-foreground">
            OFFICIAL WALLETS
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Transparency is one of the core principles of {PROJECT.name}.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            All official wallets are public and can be verified on-chain.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Every wallet card below shows the wallet&apos;s initial allocation at launch and its
            current on-chain HANSOME balance, read live from the contract. This page — not the
            Litepaper — is the source of truth for current numbers.
          </p>

          {OFFICIAL_WALLETS.length > 0 ? (
            <OfficialWalletsGrid wallets={OFFICIAL_WALLETS} />
          ) : (
            <div className="gold-border mt-14 w-full rounded-2xl px-6 py-10 text-center text-muted sm:px-10">
              <p>No contract has been deployed yet.</p>
              <p className="mt-2">
                Official wallets will be published here once HANSOME ALPACAS is live.
              </p>
            </div>
          )}

          <section aria-labelledby="allocation-title" className="mt-16 w-full text-left">
            <h2
              id="allocation-title"
              className="text-center font-[family-name:var(--font-anton)] text-[clamp(1.5rem,5vw,2.5rem)] tracking-[0.08em] text-foreground"
            >
              INITIAL TOKEN ALLOCATION
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-muted">
              This is how the supply was split at launch — not each wallet&apos;s current balance.
              See the wallet cards above for live balances.
            </p>

            <div className="gold-border mt-8 rounded-2xl p-6 sm:p-8">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="tokenomics-card rounded-xl px-4 py-5 text-center">
                  <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">Liquidity</dt>
                  <dd className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.08em] text-gold-light">
                    {TOKEN_ALLOCATION.liquidity}
                  </dd>
                </div>
                <div className="tokenomics-card rounded-xl px-4 py-5 text-center">
                  <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">Treasury</dt>
                  <dd className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.08em] text-gold-light">
                    {TOKEN_ALLOCATION.treasury}
                  </dd>
                </div>
                <div className="tokenomics-card rounded-xl px-4 py-5 text-center">
                  <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">Founder</dt>
                  <dd className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.08em] text-gold-light">
                    {TOKEN_ALLOCATION.founder}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-border/60 pt-6 text-center">
                <p className="text-xs uppercase tracking-[0.22em] text-gold-light">Total Supply</p>
                <p className="mt-2 font-[family-name:var(--font-anton)] text-xl tracking-[0.08em] text-foreground sm:text-2xl">
                  {TOKEN_ALLOCATION.totalSupply}
                </p>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="notice-title"
            className="gold-border mt-12 w-full rounded-2xl p-6 text-left sm:p-8"
          >
            <h2
              id="notice-title"
              className="font-[family-name:var(--font-anton)] text-lg tracking-[0.1em] text-foreground sm:text-xl"
            >
              TRANSPARENCY NOTICE
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted sm:text-base">
              <p>All official wallets are public.</p>
              <p>
                Transfers between official wallets are internal operational transfers and do not
                represent market sales.
              </p>
              <p>
                The Treasury&apos;s 90% figure describes its initial allocation at launch, not a
                fixed or permanent balance. Per the Liquidity Policy in the Litepaper, Treasury
                tokens are deployed into the official Uniswap v4 liquidity position over time. A
                decreasing Treasury balance usually means tokens moved into that liquidity
                position, not that they were sold — the Liquidity Wallet&apos;s position (visible
                above) is where they end up.
              </p>
            </div>
          </section>
        </section>
      </main>

      <FooterSection />
    </>
  );
}
