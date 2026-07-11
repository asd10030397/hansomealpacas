import Image from "next/image";
import Link from "next/link";
import { ASSETS, PROJECT } from "@/content/project";
import { TOKEN_LIST_URL, UGLY_TOKEN_ADDRESS, getUglyLogo256Url, robinhoodChain } from "@/lib/chain";

export const metadata = {
  title: `Token List | ${PROJECT.name}`,
  description: "Official UGLY DEER token list for Robinhood Chain wallets and DEX interfaces.",
};

export default function TokenListPage() {
  const listJsonPath = "/token-list/ugly-deer-robinhood.tokenlist.json";
  const logoUri = getUglyLogo256Url();

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden px-6 pb-20 pt-16">
      <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center py-12 text-center">
        <Link
          href="/"
          className="mb-10 font-[family-name:var(--font-anton)] text-xs tracking-[0.28em] text-muted transition-colors hover:text-gold-light"
        >
          ← HOME
        </Link>

        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold">
          TOKEN LIST
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2rem,6vw,3.5rem)] tracking-[0.08em]">
          UGLY DEER Robinhood Chain
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Import this list in MetaMask, Rabby, or Uniswap to discover $UGLY on {robinhoodChain.name}.
        </p>

        <div className="gold-border mt-12 w-full rounded-2xl bg-white/[0.02] p-8">
          <div className="flex flex-col items-center gap-4">
            <Image
              src={ASSETS.logo}
              alt="Ugly Deer"
              width={96}
              height={96}
              className="rounded-full object-cover"
              priority
            />
            <div>
              <p className="font-[family-name:var(--font-anton)] text-xl tracking-[0.12em]">
                Ugly Deer ($UGLY)
              </p>
              <p className="mt-2 font-mono text-sm text-muted">{UGLY_TOKEN_ADDRESS}</p>
            </div>
            <p className="text-xs text-muted">
              logoURI: <span className="text-foreground">{logoUri}</span>
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={listJsonPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center border border-gold/35 bg-gold/5 px-8 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.18em] text-gold-light transition-all hover:border-gold/55"
            >
              VIEW JSON
            </a>
            <a
              href={TOKEN_LIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center border border-border px-8 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.18em] text-foreground transition-all hover:border-gold/35"
            >
              PRODUCTION URL
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
