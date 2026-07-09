"use client";

import { m } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { PROJECT } from "@/content/project";
import { trackEvent } from "@/lib/analytics";

type ShareCardProps = {
  websiteUrl: string | undefined;
  contractAddress: string | null;
};

type CopyTarget = "website" | "contract" | null;

export function ShareCard({ websiteUrl, contractAddress }: ShareCardProps) {
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
        text: PROJECT.taglineCN,
        url: websiteUrl ?? undefined,
      });
      trackEvent("share", { method: "native" });
      setShareError(false);
    } catch {
      /* user cancelled */
    }
  }, [websiteUrl]);

  const xShareUrl = websiteUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${PROJECT.name}\n${PROJECT.taglineCN}`)}&url=${encodeURIComponent(websiteUrl)}`
    : `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${PROJECT.name}\n${PROJECT.taglineCN}`)}`;

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
          SHARE ON X
        </m.a>

        {websiteUrl && (
          <m.button
            type="button"
            whileHover={{ opacity: 0.7 }}
            transition={{ duration: 0.2 }}
            className={buttonClass}
            onClick={() => copyText(websiteUrl, "website")}
            aria-label="Copy website URL"
          >
            {copied === "website" ? "COPIED" : "COPY URL"}
          </m.button>
        )}

        {contractAddress && (
          <m.button
            type="button"
            whileHover={{ opacity: 0.7 }}
            transition={{ duration: 0.2 }}
            className={buttonClass}
            onClick={() => copyText(contractAddress, "contract")}
            aria-label="Copy contract address"
          >
            {copied === "contract" ? "COPIED" : "COPY CA"}
          </m.button>
        )}

        {canNativeShare && websiteUrl && (
          <m.button
            type="button"
            whileHover={{ opacity: 0.7 }}
            transition={{ duration: 0.2 }}
            className={buttonClass}
            onClick={handleNativeShare}
            aria-label="Share via device"
          >
            SHARE
          </m.button>
        )}
      </div>

      {shareError && (
        <p className="text-xs text-muted" role="status">
          Copy failed. Try again.
        </p>
      )}
    </div>
  );
}
