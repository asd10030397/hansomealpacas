"use client";

import { m } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { PROJECT } from "@/content/project";
import { useLocale } from "@/context/LocaleContext";
import { trackEvent } from "@/lib/analytics";

type ShareCardProps = {
  websiteUrl: string | undefined;
  contractAddress: string | null;
};

type CopyTarget = "website" | "contract" | null;

export function ShareCard({ websiteUrl, contractAddress }: ShareCardProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [shareError, setShareError] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const copyText = useCallback(async (text: string, target: CopyTarget) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      setShareError(false);
      trackEvent("copy", { target: target ?? "unknown" });
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
      setShareError(true);
    }
  }, []);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;

    try {
      await navigator.share({
        title: PROJECT.name,
        text: t.hero.tagline,
        url: websiteUrl ?? undefined,
      });
      trackEvent("share", { method: "native" });
      setShareError(false);
    } catch {
      /* user cancelled */
    }
  }, [t.hero.tagline, websiteUrl]);

  const xShareUrl = websiteUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${PROJECT.name}\n${t.hero.tagline}`)}&url=${encodeURIComponent(websiteUrl)}`
    : `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${PROJECT.name}\n${t.hero.tagline}`)}`;

  const buttonClass =
    "inline-flex min-w-[9rem] items-center justify-center border border-border px-6 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.2em] text-foreground sm:text-sm";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <m.a
          href={xShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ opacity: 0.7 }}
          transition={{ duration: 0.2 }}
          className={buttonClass}
          onClick={() => trackEvent("share", { method: "x" })}
        >
          {t.contract.shareOnX}
        </m.a>

        {websiteUrl && (
          <m.button
            type="button"
            whileHover={{ opacity: 0.7 }}
            transition={{ duration: 0.2 }}
            className={buttonClass}
            onClick={() => copyText(websiteUrl, "website")}
            aria-label={t.a11y.copyWebsite}
          >
            {copied === "website" ? t.contract.copied : t.contract.copyUrl}
          </m.button>
        )}

        {contractAddress && (
          <m.button
            type="button"
            whileHover={{ opacity: 0.7 }}
            transition={{ duration: 0.2 }}
            className={buttonClass}
            onClick={() => copyText(contractAddress, "contract")}
            aria-label={t.a11y.copyContract}
          >
            {copied === "contract" ? t.contract.copied : t.contract.copyCa}
          </m.button>
        )}

        {canNativeShare && websiteUrl && (
          <m.button
            type="button"
            whileHover={{ opacity: 0.7 }}
            transition={{ duration: 0.2 }}
            className={buttonClass}
            onClick={handleNativeShare}
            aria-label={t.a11y.shareDevice}
          >
            {t.contract.share}
          </m.button>
        )}
      </div>

      {shareError && (
        <p className="text-xs text-muted" role="status">
          {t.contract.copyFailed}
        </p>
      )}
    </div>
  );
}
