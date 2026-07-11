import Link from "next/link";
import { WalletCard } from "@/components/transparency/WalletCard";
import { FooterSection } from "@/sections/FooterSection";
import { OFFICIAL_WALLETS, TOKEN_ALLOCATION } from "@/content/transparency";
import { PROJECT } from "@/content/project";

export const metadata = {
  title: "Official Wallets | UGLY",
  description:
    "Official UGLY wallets, treasury allocation, founder wallet, and liquidity wallet.",
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

          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold sm:text-sm">
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

          <div className="mt-14 grid w-full grid-cols-1 gap-6">
            {OFFICIAL_WALLETS.map((wallet) => (
              <WalletCard key={wallet.id} wallet={wallet} />
            ))}
          </div>

          <section aria-labelledby="allocation-title" className="mt-16 w-full text-left">
            <h2
              id="allocation-title"
              className="text-center font-[family-name:var(--font-anton)] text-[clamp(1.5rem,5vw,2.5rem)] tracking-[0.08em] text-foreground"
            >
              TOKEN ALLOCATION
            </h2>

            <div className="gold-border mt-8 rounded-2xl bg-white/[0.02] p-6 sm:p-8">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="tokenomics-card rounded-xl px-4 py-5 text-center">
                  <dt className="text-xs uppercase tracking-[0.22em] text-gold/70">Liquidity</dt>
                  <dd className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.08em] text-gold-light">
                    {TOKEN_ALLOCATION.liquidity}
                  </dd>
                </div>
                <div className="tokenomics-card rounded-xl px-4 py-5 text-center">
                  <dt className="text-xs uppercase tracking-[0.22em] text-gold/70">Treasury</dt>
                  <dd className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.08em] text-gold-light">
                    {TOKEN_ALLOCATION.treasury}
                  </dd>
                </div>
                <div className="tokenomics-card rounded-xl px-4 py-5 text-center">
                  <dt className="text-xs uppercase tracking-[0.22em] text-gold/70">Founder</dt>
                  <dd className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.08em] text-gold-light">
                    {TOKEN_ALLOCATION.founder}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-border/60 pt-6 text-center">
                <p className="text-xs uppercase tracking-[0.22em] text-gold/70">Total Supply</p>
                <p className="mt-2 font-[family-name:var(--font-anton)] text-xl tracking-[0.08em] text-foreground sm:text-2xl">
                  {TOKEN_ALLOCATION.totalSupply}
                </p>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="notice-title"
            className="gold-border mt-12 w-full rounded-2xl bg-white/[0.02] p-6 text-left sm:p-8"
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
            </div>
          </section>
        </section>
      </main>

      <FooterSection />
    </>
  );
}
