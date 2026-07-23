"use client";

import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { FadeIn } from "@/components/FadeIn";
import { FooterSection } from "@/sections/FooterSection";
import { useLocale } from "@/context/LocaleContext";
import {
  ANDROID_APK_PUBLIC_URL,
  ANDROID_APK_SHA256,
  ANDROID_APK_STABLE_PATH,
  ANDROID_APK_VERSIONED_PATH,
  ANDROID_BUILD_DATE,
} from "@/lib/androidDownload";

type DownloadPageContentProps = {
  fileSizeLabel: string;
};

export function DownloadPageContent({ fileSizeLabel }: DownloadPageContentProps) {
  const { t } = useLocale();

  return (
    <>
      <main id="main-content" className="relative min-h-screen overflow-x-hidden px-6 pb-12 pt-16">
        <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />

        <FadeIn className="relative z-10 mx-auto flex w-full max-w-3xl flex-col py-12 text-center">
          <Link
            href="/"
            className="mb-10 self-center font-[family-name:var(--font-anton)] text-xs tracking-[0.28em] text-muted transition-colors hover:text-gold-light"
          >
            {t.download.backHome}
          </Link>

          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold-light sm:text-sm">
            {t.download.eyebrow}
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(1.75rem,6vw,3.25rem)] leading-[1.25] tracking-[0.08em] text-foreground">
            {t.download.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {t.download.subtitle}
          </p>

          <div className="gold-border mt-10 w-full rounded-2xl px-6 py-8 text-left sm:px-10">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">
                  {t.download.buildDate}
                </dt>
                <dd className="mt-2 font-medium text-foreground">{ANDROID_BUILD_DATE}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">
                  {t.download.fileSize}
                </dt>
                <dd className="mt-2 font-medium text-foreground">{fileSizeLabel}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-[0.22em] text-gold-light">
                  {t.download.sha256}
                </dt>
                <dd className="mt-2 break-all font-mono text-sm text-foreground">{ANDROID_APK_SHA256}</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-col items-center gap-4 border-t border-border/60 pt-8">
              <ActionButton
                href={ANDROID_APK_STABLE_PATH}
                size="lg"
                variant="gold"
                sublabel={t.download.downloadSubtext}
              >
                {t.download.downloadApk}
              </ActionButton>
              <p className="max-w-xl text-center text-sm leading-relaxed text-muted">
                {t.download.directApkNote}
              </p>
              <div className="w-full space-y-2 text-left text-sm text-muted">
                <p>
                  <span className="font-medium text-foreground">{t.download.stableLabel}:</span>{" "}
                  <a
                    href={ANDROID_APK_STABLE_PATH}
                    className="break-all text-gold-light underline-offset-2 hover:underline"
                  >
                    {ANDROID_APK_PUBLIC_URL}
                  </a>
                </p>
                <p>
                  <span className="font-medium text-foreground">{t.download.versionedLabel}:</span>{" "}
                  <a
                    href={ANDROID_APK_VERSIONED_PATH}
                    className="break-all text-gold-light underline-offset-2 hover:underline"
                  >
                    {ANDROID_APK_VERSIONED_PATH}
                  </a>
                </p>
              </div>
            </div>
          </div>

          <section aria-labelledby="install-title" className="gold-border mt-10 w-full rounded-2xl p-6 text-left sm:p-8">
            <h2
              id="install-title"
              className="font-[family-name:var(--font-anton)] text-lg tracking-[0.1em] text-foreground sm:text-xl"
            >
              {t.download.installHeading}
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted sm:text-base">
              {t.download.installSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="mt-6 text-sm leading-relaxed text-muted sm:text-base">{t.download.installNote}</p>
          </section>
        </FadeIn>
      </main>

      <FooterSection />
    </>
  );
}
