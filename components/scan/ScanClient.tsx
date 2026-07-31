"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLocale } from "@/context/LocaleContext";
import type { Messages } from "@/content/i18n/types";
import { FooterSection } from "@/sections/FooterSection";
import type {
  AnalysisStageId,
  AnalysisStageState,
  ConfidenceDimension,
  ContractRiskResult,
  CreatorBehaviourResult,
  HansomeLevelId,
  LabeledHolder,
  LpIntelligence,
  ScanCacheMeta,
  ScanResponse,
  SupplyBurnIntelligence,
  SupplyBurnTriState,
  V4PositionInfo,
  WalletRelationshipSignals,
} from "@/lib/hansome-score/types";
import { toHansomeLevel } from "@/lib/hansome-score/hansome-level";
import {
  getOverallScoreBand,
  OVERALL_SCORE_BAND_LEGEND,
} from "@/lib/hansome-score/overall-band";
import {
  buildPresentationPools,
  formatUnlockDate,
  formatUsdLiquidity,
  isPerPoolLiquidityAttributionWithheld,
  sectionLiquidityTotals,
  userFacingAggregateLock,
  userFacingPositionLock,
  userFacingV4OwnershipClass,
  v4OwnershipEvidenceLines,
  type PresentationPool,
  type UserFacingLockStatus,
  type V4OwnershipEvidenceLine,
} from "@/lib/hansome-score/lp/presentation";
import {
  burnTriStateClassName,
  formatBurnedPctForDisplay,
} from "@/lib/hansome-score/supply-burn/presentation";
import {
  formatHolderPctForDisplay,
  holderCategoryTooltipKey,
  holderPresentationCategory,
  holderUnknownToneClassName,
  isHolderCoverageIncomplete,
} from "@/lib/hansome-score/holders/presentation";
import {
  creatorIdentityState,
  creatorIncompleteToneClassName,
  creatorUnknownToneClassName,
  describeCreatorBalanceDisplay,
  describeCreatorBalancePctDisplay,
  describeCreatorBurnedDisplay,
  describeCreatorReceivedDisplay,
  describeCreatorSoldCountDisplay,
  describeCreatorSoldPctDisplay,
  describeCreatorTransferredDisplay,
  describeProxyPresentation,
  isCreatorCoverageIncomplete,
  type CreatorMetricDisplay,
} from "@/lib/hansome-score/creator/presentation";
import {
  collectingEtaMessage,
  DEEP_STAGE_ESTIMATE_MS,
  deepRetryAttemptDisplay,
  hasTransferIndexProgress,
  stageEstimateExceeded,
} from "@/lib/hansome-score/heavy-token-ux";
import {
  applyMonotonicProgress,
  deriveAnalysisProgress,
  type AnalysisModuleKey,
  type AnalysisWorkflowProgress,
} from "@/lib/hansome-score/analysis-progress";
import {
  isDeepCollecting,
  isDeepRetryable,
} from "@/lib/hansome-score/scan-progress";
import {
  AnimatedRealNumber,
  ModuleProgressRow,
  OverallDeepProgressPanel,
} from "@/components/scan/AnalysisProgressUI";

type CreatorVisualStatus = "clean" | "some" | "significant" | "insufficient";
type CreatorDataStatus = "complete" | "partial" | "limited";

type ClientScanResponse = ScanResponse & { cache?: ScanCacheMeta };

type ScanUiError = {
  title: string;
  hint?: string;
};

type ScanApiErrorBody = {
  error?: string;
  code?: string;
};

type Props = {
  initialAddress?: string;
  initialResult?: ScanResponse | null;
  initialError?: string | null;
  /** When true and no initialResult, auto-fetch /api/scan on mount (non-blocking SSR). */
  autoFetch?: boolean;
};

function classifyScanApiError(
  status: number,
  body: ScanApiErrorBody,
  s: Messages["scan"],
): ScanUiError {
  const code = (body.code ?? "").toLowerCase();
  const msg = (body.error ?? "").toLowerCase();

  if (
    code === "token_not_found" ||
    status === 404 ||
    msg.includes("no supported token contract")
  ) {
    return { title: s.tokenNotFound };
  }

  if (
    code === "invalid_address" ||
    status === 400 ||
    msg.includes("invalid token address") ||
    msg.includes("invalid address") ||
    msg.includes("is invalid")
  ) {
    return {
      title: s.invalidAddressTitle,
      hint: s.invalidAddressHint,
    };
  }

  // Keep RPC / Blockscout / timeout / server failures generic.
  return { title: s.scanFailed };
}

function classifyScanMessage(
  message: string | null | undefined,
  s: Messages["scan"],
): ScanUiError | null {
  if (!message) return null;
  return classifyScanApiError(0, { error: message }, s);
}

type ScanMessages = Messages["scan"];

function ScoreTone(score: number): string {
  if (score >= 80) return "text-gold-light";
  if (score >= 55) return "text-foreground";
  return "text-red-700";
}

function ScoreNumber({
  children,
  className,
  spacingClass = "mt-2",
  /** When set, transition display from prior real value → this real value. */
  animateValue,
  animateSuffix = "",
}: {
  children?: ReactNode;
  className: string;
  spacingClass?: string;
  animateValue?: number;
  animateSuffix?: string;
}) {
  return (
    <div className={`${spacingClass} flex w-full justify-center text-center`}>
      <p className={`pl-[0.08em] ${className}`}>
        {animateValue != null ? (
          <AnimatedRealNumber value={animateValue} suffix={animateSuffix} />
        ) : (
          children
        )}
      </p>
    </div>
  );
}

function TopScoreCard({
  title,
  label,
  children,
  className = "",
}: {
  title?: string;
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`gold-border flex h-full min-h-[16rem] flex-col rounded-2xl p-5 text-center ${className}`}
      title={title}
    >
      <div className="shrink-0">{label}</div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

/** `0x` + 6 hex + `...` + 5 hex (e.g. 0x8366a3...40951). */
function truncateHolderAddress(address: string): string {
  const a = address.trim();
  if (a.length <= 13) return a;
  return `${a.slice(0, 8)}...${a.slice(-5)}`;
}

type HolderLabelParts = {
  title: string;
  detail?: string;
  /** True when address could not be reliably classified. */
  unknown?: boolean;
};

function holderCategoryTooltipText(
  s: ScanMessages,
  label?: string,
): string | null {
  const key = holderCategoryTooltipKey(holderPresentationCategory(label));
  if (!key) return null;
  return s[key];
}

function holderLabelParts(s: ScanMessages, label?: string): HolderLabelParts | null {
  if (!label) {
    return { title: s.holderUnknownWalletLabel, unknown: true };
  }
  const lower = label.toLowerCase();

  if (lower.includes("poolmanager") || lower.includes("amm liquidity")) {
    return {
      title: s.holderLabelPoolManager,
      detail: s.holderLabelLiquidityPool,
    };
  }

  if (lower === "burn address") {
    return { title: s.holderLabelBurn };
  }

  const officialMatch = label.match(/^(.*?)\s*\(official\)$/i);
  if (officialMatch) {
    const rawTitle = officialMatch[1].trim();
    const title =
      rawTitle.toLowerCase() === "founder wallet"
        ? s.holderLabelFounder
        : rawTitle;
    return { title, detail: s.holderLabelOfficial };
  }

  const cleaned = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return { title: cleaned || label };
}

function formatHolderLabelLine(parts: HolderLabelParts): string {
  return parts.detail ? `${parts.title} · ${parts.detail}` : parts.title;
}

function hansomeLevelDescription(s: ScanMessages, id: HansomeLevelId): string {
  switch (id) {
    case "not_hansome":
      return s.hansomeLevelDescNotHansome;
    case "kinda_hansome":
      return s.hansomeLevelDescKindaHansome;
    case "hansome":
      return s.hansomeLevelDescHansome;
    case "very_hansome":
      return s.hansomeLevelDescVeryHansome;
    case "too_hansome":
      return s.hansomeLevelDescTooHansome;
    default:
      return s.hansomeLevelDescKindaHansome;
  }
}

function confidenceDimLabel(s: ScanMessages, id: ConfidenceDimension["id"]): string {
  switch (id) {
    case "contract":
      return s.confidenceDimContract;
    case "liquidity":
      return s.confidenceDimLiquidity;
    case "holders":
      return s.confidenceDimHolders;
    case "wallet":
      return s.confidenceDimWallet;
    case "creator":
      return s.confidenceDimCreator;
    default:
      return id;
  }
}

function confidenceDimBand(s: ScanMessages, band: ConfidenceDimension["band"]): string {
  if (band === "High") return s.confidenceBandHigh;
  if (band === "Medium") return s.confidenceBandMedium;
  return s.confidenceBandLow;
}

function hasEvidence(d: ConfidenceDimension, code: string): boolean {
  return d.evidence.some((e) => e === code || e.startsWith(`${code}=`) || e.startsWith(`${code}_`));
}

/** Plain-language blurb — driven by band / incomplete / evidence, not hardcoded per token. */
function confidenceDimBlurb(s: ScanMessages, d: ConfidenceDimension): string {
  switch (d.id) {
    case "contract":
      if (
        d.incomplete &&
        !hasEvidence(d, "no_honeypot_swap_simulation") &&
        (hasEvidence(d, "contract_risk_incomplete") ||
          hasEvidence(d, "contract_unverified") ||
          hasEvidence(d, "missing_token_meta"))
      ) {
        return s.confidenceDimBlurbContractIncomplete;
      }
      return s.confidenceDimBlurbContract;
    case "liquidity":
      return d.incomplete
        ? s.confidenceDimBlurbLiquidityIncomplete
        : s.confidenceDimBlurbLiquidity;
    case "holders":
      if (d.band === "High") return s.confidenceDimBlurbHoldersHigh;
      if (d.band === "Medium") return s.confidenceDimBlurbHoldersMedium;
      return s.confidenceDimBlurbHoldersLow;
    case "wallet":
      return d.evidence.some((e) => e.startsWith("wallet_graph_sampled"))
        ? s.confidenceDimBlurbWalletSampled
        : s.confidenceDimBlurbWallet;
    case "creator":
      return d.incomplete
        ? s.confidenceDimBlurbCreatorIncomplete
        : s.confidenceDimBlurbCreator;
    default:
      return "";
  }
}

/** Map creator evidence → user-facing visual status. Never invent sells. */
function creatorVisualStatus(cb: CreatorBehaviourResult): CreatorVisualStatus {
  // Observed sells/dumps win even when the index is still provisional for Score.
  if (cb.dumpDetected) return "significant";
  if (
    cb.transferThenSellDetected ||
    cb.sellTransferCount > 0 ||
    cb.transferThenSellRecipientCount > 0
  ) {
    return "some";
  }
  // No usable transfer sample yet → cannot claim “not detected”.
  if (cb.transfersIndexed <= 0 && !cb.available) return "insufficient";
  // Partial or complete index with zero observed sells → plain-language clean.
  return "clean";
}

/** Map indexed/incomplete flags → Complete / Partial / Limited. */
function creatorDataStatus(cb: CreatorBehaviourResult): CreatorDataStatus {
  if (cb.status === "indexed" && cb.available) return "complete";
  if (cb.transfersIndexed > 0 || cb.pagesFetched > 0) return "partial";
  return "limited";
}

function creatorStatusLabel(s: ScanMessages, status: CreatorVisualStatus): string {
  switch (status) {
    case "clean":
      return s.creatorStatusClean;
    case "some":
      return s.creatorStatusSome;
    case "significant":
      return s.creatorStatusSignificant;
    case "insufficient":
      return s.creatorStatusInsufficient;
    default:
      return s.creatorStatusInsufficient;
  }
}

function creatorExplain(s: ScanMessages, status: CreatorVisualStatus): string {
  switch (status) {
    case "clean":
      return s.creatorExplainClean;
    case "some":
      return s.creatorExplainSome;
    case "significant":
      return s.creatorExplainSignificant;
    case "insufficient":
      return s.creatorExplainInsufficient;
    default:
      return s.creatorExplainInsufficient;
  }
}

function creatorDataStatusLabel(s: ScanMessages, status: CreatorDataStatus): string {
  if (status === "complete") return s.creatorDataComplete;
  if (status === "partial") return s.creatorDataPartial;
  return s.creatorDataLimited;
}

function creatorStatusTone(status: CreatorVisualStatus): string {
  if (status === "clean") return "text-foreground";
  if (status === "insufficient") return "text-muted";
  if (status === "significant") return "text-red-800";
  return "text-amber-900";
}

function lockStatusLabel(s: ScanMessages, status: UserFacingLockStatus): string {
  switch (status) {
    case "LOCKED":
      return s.lockStatusLocked;
    case "UNLOCKED":
      return s.lockStatusUnlocked;
    case "PARTIALLY_LOCKED":
      return s.lockStatusPartiallyLocked;
    case "UNKNOWN":
    default:
      return s.lockStatusUnknown;
  }
}

function lockStatusTone(status: UserFacingLockStatus): string {
  if (status === "PARTIALLY_LOCKED") return "text-amber-900";
  if (status === "UNLOCKED") return "text-red-800";
  if (status === "UNKNOWN") return "text-muted";
  return "text-foreground";
}

function lockStatusPanelClass(status: UserFacingLockStatus): string {
  if (status === "PARTIALLY_LOCKED") {
    return "border border-amber-800/35 bg-amber-950/10";
  }
  if (status === "UNLOCKED") {
    return "border border-red-700/40 bg-red-950/10";
  }
  if (status === "UNKNOWN") {
    return "border border-border/70 bg-surface/80";
  }
  return "bg-surface/60";
}

function poolsDetectedHeadline(s: ScanMessages, count: number): string {
  if (count <= 0) return s.poolsDetectedNone;
  if (count === 1) return s.poolsDetectedOne;
  return fill(s.poolsDetectedMany, { count });
}

function positionValueSuffix(s: ScanMessages, p: V4PositionInfo): string {
  const formatted = formatUsdLiquidity(p.valueUsd ?? null);
  if (!formatted) return s.positionValueUnavailable;
  return fill(s.positionValueSuffix, { value: formatted });
}

function positionLockDetailLine(
  s: ScanMessages,
  p: V4PositionInfo,
  locale: string,
): string {
  const status = userFacingPositionLock(p.lockState);
  const value = positionValueSuffix(s, p);
  if (status === "LOCKED") {
    const date = formatUnlockDate(p.unlockDateUtc, locale);
    if (date) {
      return fill(s.positionLockedUntil, { id: p.positionNftId, date, value });
    }
    return fill(s.positionLocked, { id: p.positionNftId, value });
  }
  if (status === "UNLOCKED") {
    return fill(s.positionUnlocked, { id: p.positionNftId, value });
  }
  return fill(s.positionUnknown, { id: p.positionNftId, value });
}

/** Conditional warnings from real incomplete flags / evidence — never invent gaps. */
function confidenceDimWarnings(s: ScanMessages, d: ConfidenceDimension): string[] {
  const warnings: string[] = [];
  if (d.id === "contract" && hasEvidence(d, "no_honeypot_swap_simulation")) {
    warnings.push(s.confidenceDimWarnBuySellSim);
  }
  if (d.id === "liquidity") {
    if (hasEvidence(d, "lock_pct_unavailable")) {
      warnings.push(s.confidenceDimWarnLiquidityRanges);
    }
    if (
      hasEvidence(d, "position_discovery_incomplete") ||
      hasEvidence(d, "multi_version_coverage_incomplete") ||
      hasEvidence(d, "aggregate_unknown_incomplete")
    ) {
      warnings.push(s.confidenceDimWarnLiquidityIncomplete);
    }
  }
  return warnings;
}

function formatScanWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ScanClient({
  initialAddress = "",
  initialResult = null,
  initialError = null,
  autoFetch = false,
}: Props) {
  const router = useRouter();
  const { t } = useLocale();
  const s = t.scan;
  const [address, setAddress] = useState(initialAddress);
  const [loading, setLoading] = useState(Boolean(autoFetch && !initialResult));
  const [error, setError] = useState<ScanUiError | null>(() =>
    classifyScanMessage(initialError, s),
  );
  const [result, setResult] = useState<ClientScanResponse | null>(initialResult);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const autoFetchDone = useRef(false);

  function analysisIncomplete(r: ClientScanResponse | null): boolean {
    if (!r) return false;
    if (r.analysisStatus === "complete" || r.analysisPhase === "complete") {
      return false;
    }
    // Keep polling while Deep is running or a retryable partial can be re-armed.
    if (isDeepCollecting(r) || isDeepRetryable(r)) return true;
    // Honest terminal partial/failed — stop auto poll (manual refresh retries).
    if (r.analysisStatus === "partial" || r.analysisStatus === "failed") {
      return false;
    }
    if (r.analysisPhase === "fast" || r.analysisStatus === "deep_running") {
      return true;
    }
    if (r.scoreProvisional && r.analysisStatus === "fast_ready") return true;
    return Boolean(r.cache?.refreshing && r.analysisPhase === "fast");
  }

  async function fetchScan(trimmed: string, refresh = false) {
    const qs = new URLSearchParams({ address: trimmed });
    if (refresh) qs.set("refresh", "1");
    const res = await fetch(`/api/scan?${qs.toString()}`, { cache: "no-store" });
    const json = (await res.json()) as ClientScanResponse & ScanApiErrorBody;
    if (!res.ok) {
      throw classifyScanApiError(res.status, json, s);
    }
    if (json.cache?.refreshAvailableInSec) {
      setCooldownSec(json.cache.refreshAvailableInSec);
    }
    setResult(json);
    return json;
  }

  async function pollStatus(trimmed: string) {
    const qs = new URLSearchParams({ address: trimmed });
    const res = await fetch(`/api/scan/status?${qs.toString()}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as {
      complete?: boolean;
      result?: ClientScanResponse | null;
      error?: string;
      code?: string;
    };
    if (!res.ok) throw classifyScanApiError(res.status, json, s);
    if (json.result) {
      // Durable progress: ignore older sequence within the same deepAttemptId.
      setResult((prev) => {
        const incoming = json.result!;
        if (!prev) return incoming;
        const sameAttempt =
          prev.deepAttemptId != null &&
          incoming.deepAttemptId != null &&
          prev.deepAttemptId === incoming.deepAttemptId;
        const prevSeq = prev.deepProgress?.sequence ?? 0;
        const nextSeq = incoming.deepProgress?.sequence ?? 0;
        if (sameAttempt && nextSeq > 0 && nextSeq < prevSeq) {
          return prev;
        }
        return incoming;
      });
    }
    return json;
  }

  async function onScan(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) {
      setError({ title: s.pasteAddress });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetchScan(trimmed, false);
      router.replace(`/scan/${trimmed}`);
    } catch (err) {
      setResult(null);
      setError(
        err && typeof err === "object" && "title" in err
          ? (err as ScanUiError)
          : { title: s.scanFailed },
      );
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    const trimmed = address.trim();
    if (!trimmed || refreshing || cooldownSec > 0) return;
    setRefreshing(true);
    setError(null);
    try {
      await fetchScan(trimmed, true);
    } catch (err) {
      setError(
        err && typeof err === "object" && "title" in err
          ? (err as ScanUiError)
          : { title: s.scanFailed },
      );
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!autoFetch || initialResult || autoFetchDone.current) return;
    autoFetchDone.current = true;
    const trimmed = address.trim();
    if (!trimmed) return;
    setLoading(true);
    void fetchScan(trimmed, false)
      .catch((err) => {
        setError(
          err && typeof err === "object" && "title" in err
            ? (err as ScanUiError)
            : { title: s.scanFailed },
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only autoFetch for SSR shell
  }, [autoFetch, initialResult]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setTimeout(() => setCooldownSec((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldownSec]);

  // Poll deep analysis status every few seconds while incomplete
  useEffect(() => {
    if (!result || !analysisIncomplete(result)) return;
    const trimmed = address.trim();
    if (!trimmed) return;
    let cancelled = false;
    const tick = () => {
      void pollStatus(trimmed).catch(() => {
        /* keep prior fast result */
      });
    };
    const id = window.setInterval(() => {
      if (!cancelled) tick();
    }, 3500);
    tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll while incomplete for this address
  }, [
    address,
    result?.analysisStatus,
    result?.analysisPhase,
    result?.scoreProvisional,
    result?.deepRetryCount,
    result?.cache?.refreshing,
  ]);

  return (
    <>
      <main id="main-content" className="relative min-h-screen overflow-x-hidden px-4 pb-12 pt-14 sm:px-6 sm:pt-16">
        <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />

        <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col py-8 text-center sm:py-12">
          <Link
            href="/"
            className="mb-8 self-center font-[family-name:var(--font-anton)] text-xs tracking-[0.28em] text-muted transition-colors hover:text-gold-light"
          >
            {s.backHome}
          </Link>

          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold-light sm:text-sm">
            {s.eyebrow}
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(1.75rem,7vw,3.25rem)] tracking-[0.08em] text-foreground">
            {s.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {s.subtitle}
          </p>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted/70 sm:text-sm">
            {s.subtitleSecondary}
          </p>
          <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-muted/70 sm:text-sm">
            {s.subtitleTertiary}
          </p>

          <form onSubmit={onScan} className="gold-border mt-10 rounded-2xl p-4 text-left sm:p-6">
            <label
              htmlFor="token-address"
              className="text-xs uppercase tracking-[0.22em] text-gold-light"
            >
              {s.addressLabel}
            </label>
            <input
              id="token-address"
              name="address"
              value={address}
              onChange={(ev) => setAddress(ev.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="mt-3 w-full rounded-xl border border-border/70 bg-surface px-3 py-3 font-mono text-xs text-foreground outline-none focus:border-gold sm:text-sm"
              placeholder={s.addressPlaceholder}
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <button
                type="submit"
                disabled={loading}
                className="pixel-btn inline-flex items-center justify-center border border-wood bg-gradient-to-b from-gold-pale to-gold px-8 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.18em] text-wood-dark disabled:opacity-60 sm:text-sm"
              >
                {loading ? s.scanning : s.scan}
              </button>
              {result ? (
                <button
                  type="button"
                  disabled={refreshing || loading || cooldownSec > 0}
                  onClick={() => void onRefresh()}
                  className="inline-flex items-center justify-center rounded-xl border border-border/70 px-4 py-3 text-xs tracking-[0.14em] text-muted transition-colors hover:border-gold-light hover:text-gold-light disabled:opacity-50 sm:text-sm"
                >
                  {refreshing
                    ? s.refreshingAnalysis
                    : cooldownSec > 0
                      ? fill(s.refreshCooldown, { sec: cooldownSec })
                      : s.refreshAnalysis}
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-[0.65rem] leading-snug text-muted/75 sm:text-[0.7rem]">
              {s.landingDisclaimer}
              <br />
              {s.landingDisclaimerSecondary}
            </p>
            {loading && !result ? (
              <p className="mt-4 animate-pulse text-xs leading-relaxed text-muted sm:text-sm">
                {s.scanningProgress}
              </p>
            ) : null}
            <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.65rem] leading-snug text-muted/80 sm:text-[0.7rem]">
              <span>{s.capabilityRobinhood}</span>
              <span aria-hidden className="text-muted/50">
                ·
              </span>
              <span className="inline-flex max-w-full items-center gap-1">
                <span>{s.capabilityUniswap}</span>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/70 text-[0.55rem] leading-none text-muted hover:border-gold-light hover:text-gold-light"
                  title={s.capabilityUniswapTooltip}
                  aria-label={s.capabilityUniswapTooltip}
                >
                  i
                </button>
              </span>
              <span aria-hidden className="text-muted/50">
                ·
              </span>
              <span>{s.capabilityScores}</span>
              <span aria-hidden className="text-muted/50">
                ·
              </span>
              <span>{s.capabilityHansomeLevel}</span>
              <span aria-hidden className="text-muted/50">
                ·
              </span>
              <span>{s.capabilityCoverage}</span>
            </p>
          </form>

          {error ? (
            <div
              role="alert"
              className="gold-border mt-6 rounded-2xl border-red-700/40 px-4 py-4 text-left text-sm text-red-800"
            >
              <p className="font-[family-name:var(--font-anton)] text-sm tracking-[0.06em] sm:text-base">
                {error.title}
              </p>
              {error.hint ? (
                <p className="mt-2 text-xs leading-relaxed text-red-800/85 sm:text-sm">
                  {error.hint}
                </p>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="mt-4 flex flex-col items-center gap-1 px-2 text-center text-xs text-muted sm:text-sm">
              <p>
                {fill(
                  result.cache?.stale || result.cache?.refreshing
                    ? s.lastUpdatedStale
                    : s.lastUpdated,
                  { when: formatScanWhen(result.scannedAt) },
                )}
              </p>
              {result.scoreComputedAt ? (
                <p className="text-[0.65rem] text-muted/75 sm:text-xs">
                  {fill(s.scoreComputedAt, {
                    when: formatScanWhen(result.scoreComputedAt),
                  })}
                </p>
              ) : null}
              {result.activityUpdatedAt ? (
                <p className="text-[0.65rem] text-muted/75 sm:text-xs">
                  {fill(s.activityUpdatedAt, {
                    when: formatScanWhen(result.activityUpdatedAt),
                  })}
                </p>
              ) : null}
              {result.cache?.hit ? (
                <p className="text-[0.65rem] text-muted/70 sm:text-xs">{s.fromCache}</p>
              ) : null}
            </div>
          ) : null}

          {result ? <ScanResults result={result} s={s} /> : null}
        </section>
      </main>
      <FooterSection />
    </>
  );
}

/** User-facing Deep Analysis stages (excludes score). */
const DEEP_PROGRESS_STAGE_IDS: AnalysisStageId[] = [
  "contract",
  "holders",
  "market",
  "burn",
  "liquidity",
  "creator",
  "relationships",
];

function stageLabel(s: ScanMessages, id: AnalysisStageId): string {
  switch (id) {
    case "contract":
      return s.stageContract;
    case "holders":
      return s.stageHolders;
    case "market":
      return s.stageMarket;
    case "burn":
      return s.stageBurn;
    case "liquidity":
      return s.stageLiquidity;
    case "creator":
      return s.stageCreator;
    case "relationships":
      return s.stageRelationships;
    case "score":
      return s.stageScore;
  }
}

function stageEstimateLabel(
  s: ScanMessages,
  id: AnalysisStageId,
): string | null {
  if (id === "relationships") return s.deepStageEstimateRelationships;
  if (id === "creator") return s.deepStageEstimateCreator;
  if (id === "liquidity") return s.deepStageEstimateLiquidity;
  if (id === "burn") return s.deepStageEstimateBurn;
  return null;
}

/**
 * Deep stage still in flight — do not render terminal Unknown/Unavailable.
 * `pendingDeepPartial`: Fast marks burn as partial (P0/P1 done) while P2/P3
 * still await Deep — treat as collecting, not a finished gap.
 */
function stageIsCollecting(
  st: AnalysisStageState | undefined,
  pendingDeepPartial = false,
): boolean {
  if (st === "analyzing" || st === "pending") return true;
  return pendingDeepPartial && st === "partial";
}

function stageIsAnalyzing(
  st: AnalysisStageState | undefined,
  pendingDeepPartial = false,
): boolean {
  if (st === "analyzing") return true;
  // Keep spinner while burn P2/P3 are still queued/running under Deep.
  return pendingDeepPartial && st === "partial";
}

function stageIsTerminalGap(
  st: AnalysisStageState | undefined,
  pendingDeepPartial = false,
): boolean {
  if (pendingDeepPartial) return st === "failed";
  return st === "partial" || st === "failed";
}

function deepMissingLabel(
  s: ScanMessages,
  stageState: AnalysisStageState | undefined,
  terminalFallback: string,
  pendingDeepPartial = false,
): string {
  if (stageIsCollecting(stageState, pendingDeepPartial)) {
    return s.deepFieldCollecting;
  }
  if (stageIsTerminalGap(stageState, pendingDeepPartial)) {
    return s.deepFieldTemporarilyUnavailable;
  }
  return terminalFallback;
}

function PixelStageSpinner({ label }: { label: string }) {
  return (
    <span
      className="mt-3 inline-flex items-center gap-2 text-[0.7rem] tracking-[0.08em] text-amber-900"
      role="status"
      aria-live="polite"
    >
      <span className="inline-grid grid-cols-2 gap-0.5" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-pulse bg-gold-light [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse bg-gold/70 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse bg-gold/70 [animation-delay:300ms]" />
        <span className="h-1.5 w-1.5 animate-pulse bg-gold-light [animation-delay:450ms]" />
      </span>
      {label}
    </span>
  );
}

/** Elapsed ms while a section is collecting — resets when inactive. */
function useCollectingElapsed(active: boolean): number {
  const started = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      started.current = null;
      setElapsed(0);
      return;
    }
    if (started.current == null) started.current = Date.now();
    const tick = () => setElapsed(Date.now() - (started.current ?? Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return elapsed;
}

function useHonestWorkflowProgress(
  result: ClientScanResponse,
): AnalysisWorkflowProgress {
  const [held, setHeld] = useState<AnalysisWorkflowProgress | null>(null);

  useEffect(() => {
    setHeld((prev) =>
      applyMonotonicProgress(prev, deriveAnalysisProgress(result, prev)),
    );
  }, [result]);

  // First paint / SSR: derive immediately; subsequent polls stay monotonic via held.
  return held ?? deriveAnalysisProgress(result, null);
}

function AnalysisProgressPanel({
  result,
  s,
  workflow,
}: {
  result: ClientScanResponse;
  s: ScanMessages;
  workflow: AnalysisWorkflowProgress;
}) {
  const stages = result.analysisStages;
  const stillRunning = isDeepCollecting(result);
  const isTerminalPartial =
    !stillRunning &&
    (result.analysisStatus === "partial" || result.analysisStatus === "failed");

  const analyzingStartedAt = useRef<Partial<Record<AnalysisStageId, number>>>(
    {},
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!stages || !stillRunning) return;
    const t = Date.now();
    for (const id of DEEP_PROGRESS_STAGE_IDS) {
      const st = stages[id] ?? "pending";
      if (st === "analyzing" || st === "partial") {
        if (analyzingStartedAt.current[id] == null) {
          analyzingStartedAt.current[id] = t;
        }
      } else {
        delete analyzingStartedAt.current[id];
      }
    }
  }, [stages, stillRunning]);

  useEffect(() => {
    if (!stillRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [stillRunning]);

  const analyzingIds = DEEP_PROGRESS_STAGE_IDS.filter((id) => {
    const st = stages?.[id] ?? "pending";
    if (st === "analyzing") return true;
    return stillRunning && st === "partial";
  });
  const estimateExceeded = analyzingIds.some((id) => {
    const ceiling = DEEP_STAGE_ESTIMATE_MS[id];
    const started = analyzingStartedAt.current[id];
    if (started == null) return false;
    return stageEstimateExceeded(now - started, ceiling);
  });

  const pagesFetched = Math.max(
    result.overview?.creatorBehaviour?.pagesFetched ?? 0,
    result.overview?.supplyBurn?.burnActivity?.pagesFetched ?? 0,
  );
  const transfersIndexed = Math.max(
    result.overview?.creatorBehaviour?.transfersIndexed ?? 0,
    result.overview?.supplyBurn?.burnActivity?.transfersIndexed ?? 0,
  );
  const showIndexProgress =
    stillRunning &&
    hasTransferIndexProgress({ pagesFetched, transfersIndexed });
  const retryDisplay = deepRetryAttemptDisplay(result.deepRetryCount);
  const showRetry = stillRunning && (result.deepRetryCount ?? 0) > 0;

  let etaLine: string | null = null;
  if (stillRunning && analyzingIds.length > 0) {
    if (estimateExceeded) {
      etaLine = collectingEtaMessage({
        exceeded: true,
        estimateLabel: s.progressTimeVaries,
        stillAnalyzingLabel: s.deepAnalysisStillAnalyzing,
      });
    } else {
      const parts = analyzingIds
        .map((id) => {
          const est = stageEstimateLabel(s, id);
          return est ? `${stageLabel(s, id)} ${est}` : null;
        })
        .filter(Boolean);
      etaLine =
        parts.length > 0
          ? parts.join(" · ")
          : s.progressTimeVaries;
    }
  } else if (stillRunning) {
    etaLine = s.progressTimeVaries;
  }

  const progressUpdatedAt = result.deepProgress?.updatedAt
    ? Date.parse(result.deepProgress.updatedAt)
    : NaN;
  const lastUpdateAgeSec = Number.isFinite(progressUpdatedAt)
    ? Math.max(0, Math.floor((now - progressUpdatedAt) / 1000))
    : null;
  const stalled =
    stillRunning &&
    (Boolean(result.deepProgress?.stalled) ||
      (lastUpdateAgeSec != null && lastUpdateAgeSec >= 45));

  return (
    <OverallDeepProgressPanel
      workflow={workflow}
      s={s}
      etaLine={etaLine}
      indexProgressLine={
        showIndexProgress
          ? fill(s.deepCollectingProgress, {
              pages: pagesFetched,
              transfers: transfersIndexed,
            })
          : null
      }
      retryLine={
        showRetry
          ? fill(s.deepCollectingRetry, {
              attempt: retryDisplay.attempt,
              max: retryDisplay.max,
            })
          : null
      }
      lastUpdateLine={
        stillRunning && lastUpdateAgeSec != null
          ? fill(s.progressLastUpdate, { sec: lastUpdateAgeSec })
          : null
      }
      stallLine={
        stalled ? fill(s.progressStalled, { sec: lastUpdateAgeSec ?? 45 }) : null
      }
      footerNote={
        isTerminalPartial
          ? s.deepAnalysisPartialNote
          : !estimateExceeded && result.scoreProvisional
            ? s.scoreProvisionalNote
            : null
      }
    />
  );
}

function sectionModuleProgress(
  workflow: AnalysisWorkflowProgress | null | undefined,
  key: AnalysisModuleKey,
  s: ScanMessages,
  show: boolean,
) {
  if (!show || !workflow) return null;
  const mod = workflow.modules.find((m) => m.key === key);
  if (!mod) return null;
  return <ModuleProgressRow module={mod} s={s} compact />;
}

function v4EvidenceMessage(
  s: ScanMessages,
  messageKey: string,
): string {
  const value = s[messageKey as keyof ScanMessages];
  return typeof value === "string" ? value : messageKey;
}

function hookLockModelLabel(
  s: ScanMessages,
  state: string | undefined,
  discoveryComplete: boolean | undefined,
): string {
  switch (state) {
    case "HOOK_PRINCIPAL_LOCKED_ONCHAIN":
      return s.hookLockPrincipalOnchain;
    case "HOOK_TIMED_LOCK":
      return s.hookLockTimed;
    case "HOOK_PERMANENT_LOCK":
      return s.hookLockPermanent;
    case "HOOK_UNLOCKABLE":
      return s.hookLockUnlockable;
    case "HOOK_MIGRATION_PENDING":
      return s.hookLockMigrationPending;
    case "HOOK_EXITED":
      return s.hookLockExited;
    case "HOOK_GRADUATED_INCOMPLETE":
      return s.hookLockGraduatedIncomplete;
    case "UNKNOWN_INCOMPLETE":
    default:
      return discoveryComplete === false
        ? s.hookLockUnknownDiscoveryIncomplete
        : s.hookLockUnknownIncomplete;
  }
}

/**
 * Phase 11F/G/H — compact Hook Native intelligence (candidate UI).
 * No Titan badge, generic Locked, generic lock%, or Score impact.
 */
function HookNativeIntelligenceBlock({
  lp,
  s,
}: {
  lp: LpIntelligence;
  s: ScanMessages;
}) {
  const idx = lp.hookPositionIndex;
  const val = lp.hookPositionValuation;
  const foreign = lp.hookForeignLpSeparation;
  const lock = lp.hookLockClassification;
  const hookCount =
    val?.hookOwnedPositionCount ?? idx?.hookOwnedCount ?? 0;
  const discoveryComplete = idx?.hookDiscoveryComplete;
  const positionsLabel =
    discoveryComplete === false
      ? s.hookPositionIndexPartial
      : fill(s.hookPositionsDetected, { count: hookCount });
  const valueUsd = val?.hookOwnedValueUsd ?? foreign?.hookOwnedValueUsd;
  const valueLabel =
    valueUsd != null && Number.isFinite(valueUsd)
      ? formatUsdLiquidity(valueUsd)
      : null;
  const foreignComplete = foreign?.poolReconstructionComplete === true;
  const evidenceBits = [
    ...(lock?.evidence ?? []).slice(0, 8),
    ...(lock?.incompleteReasons ?? []).slice(0, 4),
    ...(val?.incompleteReasons ?? []).slice(0, 4),
  ];

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="text-xs uppercase tracking-[0.16em] text-muted">
          {s.hookOwnedLiquidity}
        </dt>
        <dd className="text-foreground">{positionsLabel}</dd>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="text-xs uppercase tracking-[0.16em] text-muted">
          {s.hookPositions}
        </dt>
        <dd className="text-foreground">
          {fill(s.hookPositionsDetected, { count: hookCount })}
        </dd>
      </div>
      {valueLabel ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">
            {s.hookOwnedValue}
          </dt>
          <dd className="text-foreground">{valueLabel}</dd>
        </div>
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="text-xs uppercase tracking-[0.16em] text-muted">
          {s.foreignLpDiscovery}
        </dt>
        <dd className="text-foreground">
          {foreignComplete
            ? s.foreignLpDiscoveryComplete
            : s.foreignLpDiscoveryPartial}
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="text-xs uppercase tracking-[0.16em] text-muted">
          {s.hookLockModel}
        </dt>
        <dd className="text-foreground">
          {hookLockModelLabel(s, lock?.state, discoveryComplete)}
        </dd>
      </div>
      {lock?.state === "HOOK_PRINCIPAL_LOCKED_ONCHAIN" ? (
        <p className="text-[0.65rem] leading-relaxed text-muted">
          {s.hookLockTechnicalNote}
        </p>
      ) : null}
      {discoveryComplete === false ? (
        <p className="text-[0.65rem] leading-relaxed text-muted">
          {s.hookPositionIndexPartialHint}
        </p>
      ) : null}
      {evidenceBits.length > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[0.65rem] uppercase tracking-[0.16em] text-muted">
            {s.hookIntelligenceTechnical}
          </summary>
          <ul className="mt-1 space-y-0.5 text-[0.65rem] text-muted">
            {evidenceBits.map((bit) => (
              <li key={bit}>{bit}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

/** Phase 11A.1 — plain-language V4 ownership evidence (not a lock claim). */
function V4OwnershipEvidencePanel({
  lines,
  s,
}: {
  lines: V4OwnershipEvidenceLine[];
  s: ScanMessages;
}) {
  const renderLines = () => (
    <ul className="mt-2 space-y-1.5 text-xs text-foreground">
      {lines.map((line) => {
        const template = v4EvidenceMessage(s, line.messageKey);
        const text = line.values ? fill(template, line.values) : template;
        return (
          <li key={line.key}>
            <span>{text}</span>
            {line.technical ? (
              <span className="mt-0.5 block text-[0.65rem] text-muted">
                {s.v4OwnershipEvidenceTechnical}: {line.technical}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Desktop: visible without opening raw technical dump */}
      <div className="mt-4 hidden border-t border-gold-light/15 pt-3 md:block">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-gold-light">
          {s.v4OwnershipEvidence}
        </p>
        {renderLines()}
      </div>
      {/* Mobile: collapsed by default */}
      <details className="mt-4 border-t border-gold-light/15 pt-3 md:hidden">
        <summary className="cursor-pointer text-[0.65rem] uppercase tracking-[0.16em] text-gold-light hover:text-foreground">
          {s.v4OwnershipEvidence}
        </summary>
        {renderLines()}
      </details>
    </>
  );
}

function LiquiditySection({
  lp,
  tokenSymbol,
  tokenAddress,
  liquidityUsd,
  s,
  stageState,
  deepRunning = false,
  moduleProgress = null,
}: {
  lp: LpIntelligence;
  tokenSymbol: string | null;
  tokenAddress: string;
  liquidityUsd: number | null;
  s: ScanMessages;
  stageState?: AnalysisStageState;
  /** True while Progressive Deep / retryable collection is still active. */
  deepRunning?: boolean;
  moduleProgress?: ReactNode;
}) {
  const { locale } = useLocale();
  const pools = buildPresentationPools({
    lp,
    tokenSymbol,
    tokenAddress,
    liquidityUsd,
  });
  // Headline = material presentation cards. Discovered (incl. dust) stays in technical details.
  const poolCount =
    pools.length > 0 ? pools.length : (lp.poolsDetectedCount ?? 0);
  const aggregateStatus = userFacingAggregateLock(lp.aggregateState);
  const totals = sectionLiquidityTotals({
    pools,
    labeledLiquidityUsd: liquidityUsd,
  });
  const showTotals = pools.length > 1 && totals.totalLiquidityUsd != null;
  const single = pools.length === 1 ? pools[0] : null;
  const counts = lp.positionCounts;
  const pendingDeepPartial = deepRunning && stageState === "partial";
  const analyzing = stageIsAnalyzing(stageState, pendingDeepPartial);
  const collecting = stageIsCollecting(stageState, pendingDeepPartial);
  // Fast-path: show Locked/Unlocked as soon as lockDistribution is present —
  // do not wait for overall deep complete or exhaustive discovery.
  const lockDistReady =
    lp.lockDistribution.available &&
    lp.lockDistribution.lockedUsd != null &&
    lp.lockDistribution.unlockedUsd != null;
  const lockStatusDisplay =
    single &&
    single.lockStatus === "UNKNOWN" &&
    collecting &&
    !lockDistReady
      ? s.deepFieldCollecting
      : single
        ? lockStatusLabel(s, single.lockStatus)
        : null;
  const lockStatusDisplayTone =
    single &&
    single.lockStatus === "UNKNOWN" &&
    collecting &&
    !lockDistReady
      ? "text-muted"
      : single
        ? lockStatusTone(single.lockStatus)
        : "text-muted";
  const evidenceLines = v4OwnershipEvidenceLines(lp.v4OwnershipEvidence);
  const isHookNative = lp.ownershipClass === "hook_native";
  const v4OwnershipLabel =
    lp.ownershipClass === "posm_nft"
      ? s.v4OwnershipPosmNft
      : isHookNative
        ? s.v4OwnershipHookNative
        : lp.ownershipClass === "unknown" && evidenceLines.length > 0
          ? s.v4OwnershipUnknown
          : userFacingV4OwnershipClass(lp.ownershipClass);
  // Phase 12A.1 — Class B: Hook classifier label, never Titan LOCKED/badge/lock%.
  const hookNativeLockLabel = isHookNative
    ? hookLockModelLabel(
        s,
        lp.hookLockClassification?.state,
        lp.hookPositionIndex?.hookDiscoveryComplete,
      )
    : null;
  const singleLockStatusDisplay = isHookNative
    ? hookNativeLockLabel
    : lockStatusDisplay;
  const singleLockStatusTone = isHookNative
    ? "text-foreground"
    : lockStatusDisplayTone;
  const singlePanelStatus = isHookNative ? "UNKNOWN" : single?.lockStatus;
  const showTitanLockDist = !isHookNative && lockDistReady;
  const showTitanPositionLocks =
    !isHookNative && Boolean(single && single.positions.length > 0);

  return (
    <section className="gold-border rounded-2xl p-5 sm:p-6">
      <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
        {s.liquidity}
      </h2>
      {moduleProgress}
      {analyzing ? (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-amber-900">{s.liquidityCollecting}</p>
          <PixelStageSpinner label={s.liquidityAnalyzingLabel} />
          <p className="text-[0.65rem] leading-relaxed text-muted/80">
            {s.liquidityEstimatedTime}
          </p>
        </div>
      ) : null}

      <p className="mt-3 font-[family-name:var(--font-anton)] text-sm tracking-[0.08em] text-foreground sm:text-base">
        {poolsDetectedHeadline(s, poolCount)}
      </p>

      {single ? (
        <div className={`mt-4 rounded-xl px-4 py-4 ${lockStatusPanelClass(singlePanelStatus ?? "UNKNOWN")}`}>
          <p className="font-[family-name:var(--font-anton)] tracking-[0.1em] text-gold-light">
            {fill(s.uniswapVersionLabel, { version: single.version.toUpperCase() })}
          </p>
          <p className="mt-1 text-sm text-foreground">{single.pairLabel}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">
                {s.poolLiquidity}
              </dt>
              <dd className="text-foreground">
                {formatUsdLiquidity(single.liquidityUsd) ?? s.liquidityUnavailable}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">
                {s.lockStatus}
              </dt>
              <dd className={singleLockStatusTone}>{singleLockStatusDisplay}</dd>
            </div>
            {v4OwnershipLabel ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-xs uppercase tracking-[0.16em] text-muted">
                  {s.v4Ownership}
                </dt>
                <dd className="text-foreground">{v4OwnershipLabel}</dd>
              </div>
            ) : null}
            {isHookNative ? (
              <HookNativeIntelligenceBlock lp={lp} s={s} />
            ) : null}
          </dl>

          <div className="mt-4 border-t border-gold-light/15 pt-3">
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-gold-light">
              {s.lockDistributionTitle}
            </p>
            {!isHookNative &&
            (lp.knownPositionsVerified ||
              lp.exhaustiveDiscoveryComplete ||
              lp.discoveryComplete) ? (
              <p className="mt-1 text-[0.65rem] text-muted">
                {[
                  lp.knownPositionsVerified ? s.verifiedKnownPositions : null,
                  lp.exhaustiveDiscoveryComplete || lp.discoveryComplete
                    ? s.fullPositionDiscoveryComplete
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {showTitanLockDist ? (
              <div className="mt-2 space-y-2">
                <div className="flex h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className="bg-emerald-800/80"
                    style={{
                      width: `${Math.max(0, Math.min(100, lp.lockDistribution.lockedPct ?? 0))}%`,
                    }}
                  />
                  <div
                    className="bg-amber-700/80"
                    style={{
                      width: `${Math.max(0, Math.min(100, lp.lockDistribution.unlockedPct ?? 0))}%`,
                    }}
                  />
                  {(lp.lockDistribution.unknownPct ?? 0) > 0 ? (
                    <div
                      className="bg-muted/50"
                      style={{
                        width: `${Math.max(0, Math.min(100, lp.lockDistribution.unknownPct ?? 0))}%`,
                      }}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-foreground">
                  {fill(s.lockedLiquidityValue, {
                    value:
                      formatUsdLiquidity(lp.lockDistribution.lockedUsd) ??
                      s.liquidityUnavailable,
                    pct: `${(lp.lockDistribution.lockedPct ?? 0).toFixed(1)}%`,
                  })}
                </p>
                <p className="text-xs text-foreground">
                  {fill(s.unlockedLiquidityValue, {
                    value:
                      formatUsdLiquidity(lp.lockDistribution.unlockedUsd) ??
                      s.liquidityUnavailable,
                    pct: `${(lp.lockDistribution.unlockedPct ?? 0).toFixed(1)}%`,
                  })}
                </p>
                {(lp.lockDistribution.unknownUsd ?? 0) > 0 ? (
                  <p className="text-xs text-foreground">
                    {fill(s.unknownLiquidityValue, {
                      value:
                        formatUsdLiquidity(lp.lockDistribution.unknownUsd) ??
                        s.liquidityUnavailable,
                      pct: `${(lp.lockDistribution.unknownPct ?? 0).toFixed(1)}%`,
                    })}
                  </p>
                ) : null}
              </div>
            ) : collecting ? (
              <div className="mt-2 space-y-1 text-xs text-muted">
                <p>{s.deepFieldCollecting}</p>
              </div>
            ) : (
              <div className="mt-2 space-y-1 text-xs text-muted">
                <p>
                  {stageIsTerminalGap(stageState, pendingDeepPartial)
                    ? s.deepFieldTemporarilyUnavailable
                    : s.lockedLiquidityUnavailable}
                </p>
                {!stageIsTerminalGap(stageState, pendingDeepPartial) ? (
                  <>
                    <p>{s.unlockedLiquidityUnavailable}</p>
                    <p>{s.lockPercentageUnavailable}</p>
                  </>
                ) : null}
                {lp.lockDistribution.reason &&
                !stageIsTerminalGap(stageState, pendingDeepPartial) ? (
                  <p className="text-[0.65rem] leading-relaxed">
                    {fill(s.lockDistributionUnavailableReason, {
                      reason: lp.lockDistribution.reason,
                    })}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {!isHookNative &&
            (counts.material > 0 ||
              counts.locked > 0 ||
              counts.unlocked > 0 ||
              counts.unknown > 0) && (
            <div className="mt-4 space-y-1 border-t border-gold-light/15 pt-3 text-xs text-muted">
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-gold-light">
                {fill(s.positionsLabel, {
                  count: counts.material || single.positions.length,
                })}
              </p>
              <p>{fill(s.lockedPositionsLabel, { count: counts.locked })}</p>
              <p>{fill(s.unlockedPositionsLabel, { count: counts.unlocked })}</p>
              {counts.unknown > 0 ? (
                <p>{fill(s.unknownPositionsLabel, { count: counts.unknown })}</p>
              ) : null}
            </div>
          )}

          {showTitanPositionLocks ? (
            <div className="mt-4 border-t border-gold-light/15 pt-3">
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-gold-light">
                {s.lockDetails}
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-foreground">
                {single.positions.map((p) => (
                  <li key={p.positionNftId}>
                    {positionLockDetailLine(s, p, locale)}
                  </li>
                ))}
              </ul>
            </div>
          ) : isHookNative ? null : collecting ? (
            <p className="mt-3 text-xs text-muted">{s.deepFieldCollecting}</p>
          ) : (
            <p className="mt-3 text-xs text-muted">
              {stageIsTerminalGap(stageState, pendingDeepPartial)
                ? s.deepFieldTemporarilyUnavailable
                : s.noPositions}
            </p>
          )}
        </div>
      ) : pools.length > 1 ? (
        <div className="mt-4 space-y-3">
          {totals.totalLiquidityUsd != null ? (
            <div className="rounded-xl px-4 py-3 text-sm ring-1 ring-gold-light/20">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">
                {s.poolLiquidity}
              </p>
              <p className="mt-1 font-[family-name:var(--font-anton)] tracking-[0.08em] text-foreground">
                {formatUsdLiquidity(totals.totalLiquidityUsd) ?? s.liquidityUnavailable}
              </p>
              <p className="mt-1 text-[0.65rem] text-muted">
                {fill(s.totalPools, { count: totals.totalPools })}
              </p>
            </div>
          ) : null}
          <ul className="space-y-2">
            {pools.map((pool: PresentationPool) => (
              <li
                key={pool.key}
                className={`rounded-xl px-3 py-3 text-sm ${lockStatusPanelClass(isHookNative ? "UNKNOWN" : pool.lockStatus)}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-[family-name:var(--font-anton)] tracking-[0.08em] text-gold-light">
                    {fill(s.uniswapVersionLabel, {
                      version: pool.version.toUpperCase(),
                    })}{" "}
                    · {pool.pairLabel}
                  </p>
                  <p
                    className={
                      isHookNative
                        ? "text-foreground"
                        : pool.lockStatus === "UNKNOWN" && collecting
                          ? "text-muted"
                          : lockStatusTone(pool.lockStatus)
                    }
                  >
                    {isHookNative
                      ? hookNativeLockLabel
                      : pool.lockStatus === "UNKNOWN" && collecting
                        ? s.deepFieldCollecting
                        : lockStatusLabel(s, pool.lockStatus)}
                  </p>
                </div>
                {isPerPoolLiquidityAttributionWithheld({
                  presentationPoolCount: pools.length,
                  poolLiquidityUsd: pool.liquidityUsd,
                  totalLiquidityUsd: totals.totalLiquidityUsd,
                }) ? (
                  <div className="mt-1">
                    <p className="inline-flex max-w-full flex-wrap items-center gap-1 text-xs text-muted">
                      <span>
                        {s.poolLiquidity}:{" "}
                        <span className="text-foreground">
                          {s.poolLiquidityIncludedInTotal}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/70 text-[0.55rem] leading-none text-muted hover:border-gold-light hover:text-gold-light"
                        title={s.poolLiquidityIncludedInTotalTooltip}
                        aria-label={s.poolLiquidityIncludedInTotalTooltip}
                      >
                        i
                      </button>
                    </p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-muted/80">
                      {s.poolLiquidityIncludedInTotalSubtitle}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted">
                    {s.poolLiquidity}:{" "}
                    <span className="text-foreground">
                      {formatUsdLiquidity(pool.liquidityUsd) ??
                        s.liquidityUnavailable}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
          {v4OwnershipLabel ? (
            <p className="mt-3 text-xs text-muted">
              {s.v4Ownership}:{" "}
              <span className="text-foreground">{v4OwnershipLabel}</span>
            </p>
          ) : null}
          {isHookNative ? (
            <dl className="mt-3 space-y-2 text-sm">
              <HookNativeIntelligenceBlock lp={lp} s={s} />
            </dl>
          ) : null}
        </div>
      ) : (
        <div className={`mt-4 rounded-xl px-4 py-4 ${lockStatusPanelClass(isHookNative ? "UNKNOWN" : aggregateStatus)}`}>
          <p
            className={
              isHookNative
                ? "text-foreground"
                : aggregateStatus === "UNKNOWN" && collecting
                  ? "text-muted"
                  : lockStatusTone(aggregateStatus)
            }
          >
            {isHookNative
              ? hookNativeLockLabel
              : aggregateStatus === "UNKNOWN" && collecting
                ? s.deepFieldCollecting
                : lockStatusLabel(s, aggregateStatus)}
          </p>
          {v4OwnershipLabel ? (
            <p className="mt-2 text-xs text-muted">
              {s.v4Ownership}:{" "}
              <span className="text-foreground">{v4OwnershipLabel}</span>
            </p>
          ) : null}
          {isHookNative ? (
            <dl className="mt-3 space-y-2 text-sm">
              <HookNativeIntelligenceBlock lp={lp} s={s} />
            </dl>
          ) : null}
        </div>
      )}

      {evidenceLines.length > 0 ? (
        <V4OwnershipEvidencePanel lines={evidenceLines} s={s} />
      ) : null}

      {/* Bottom totals only when per-pool USD was summed (avoid duplicating section aggregate). */}
      {showTotals && totals.source === "sum_of_pools" ? (
        <div className="mt-3 space-y-1 text-xs text-muted">
          <p>{fill(s.totalPools, { count: totals.totalPools })}</p>
          <p>
            {fill(s.totalLiquidity, {
              value:
                formatUsdLiquidity(totals.totalLiquidityUsd) ?? s.liquidityUnavailable,
            })}
          </p>
        </div>
      ) : null}

      <div className="mt-5 border-t border-gold-light/20 pt-4">
        <p className="text-xs text-foreground">{s.supportedVersions}</p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
          {s.supportedVersionsNote}
        </p>
      </div>

      <details className="mt-5 border-t border-gold-light/20 pt-4">
        <summary className="cursor-pointer text-xs tracking-[0.08em] text-muted hover:text-foreground">
          {s.liquidityViewTechnicalDetails}
        </summary>
        <div className="mt-3 space-y-3 text-[0.7rem] leading-relaxed text-muted">
          <p>{s.liquidityIntro}</p>
          <p>{s.principleOneLocked}</p>
          <p>
            {fill(s.internalAggregateState, {
              state:
                lp.aggregateStateDisplay ?? lp.aggregateLockStateDisplay ?? lp.aggregateState,
            })}
          </p>
          <p>
            {fill(s.versionsDetected, {
              versions:
                lp.uniswapVersions?.versionsDetected
                  ?.map((v) => v.toUpperCase())
                  .join(", ") || s.versionsNone,
            })}
          </p>
          <p>
            {fill(s.poolsPerVersion, {
              v2: lp.uniswapVersions?.byVersion?.v2?.poolsFound ?? 0,
              v3: lp.uniswapVersions?.byVersion?.v3?.poolsFound ?? 0,
              v4: lp.uniswapVersions?.byVersion?.v4?.poolsFound ?? 0,
            })}
          </p>
          <p>
            {fill(s.poolsVsPositions, {
              pools: lp.poolsDetectedCount ?? 0,
              positions: lp.positionCounts?.detected ?? 0,
            })}
          </p>
          <p>
            {fill(s.positionCounts, {
              detected: lp.positionCounts?.detected ?? 0,
              locked: lp.positionCounts?.locked ?? 0,
              unlocked: lp.positionCounts?.unlocked ?? 0,
              unknown: lp.positionCounts?.unknown ?? 0,
            })}
          </p>
          {lp.uniswapVersions && !lp.uniswapVersions.coverageComplete ? (
            <p className="text-red-800/90">
              {s.incompleteCoverageBanner}
              {lp.uniswapVersions.incompleteReason
                ? ` — ${lp.uniswapVersions.incompleteReason}`
                : ""}
            </p>
          ) : null}
          <p>{s.protocolVsLockerNote}</p>
          {!isHookNative && lp.lockDistribution?.available ? (
            <p>
              {fill(s.lockDistribution, {
                locked: (lp.lockDistribution.lockedPct ?? 0).toFixed(1),
                unlocked: (lp.lockDistribution.unlockedPct ?? 0).toFixed(1),
                lockedUsd:
                  formatUsdLiquidity(lp.lockDistribution.lockedUsd) ?? "—",
                unlockedUsd:
                  formatUsdLiquidity(lp.lockDistribution.unlockedUsd) ?? "—",
                totalUsd:
                  formatUsdLiquidity(lp.lockDistribution.totalPositionUsd) ??
                  "—",
                method:
                  lp.lockDistribution.method === "token_amounts"
                    ? "token amounts × USD"
                    : (lp.lockDistribution.method ?? "—"),
              })}
            </p>
          ) : lp.lockDistribution?.reason ? (
            <p>
              {fill(s.lockPctUnavailable, {
                reason: lp.lockDistribution.reason,
              })}
            </p>
          ) : null}
          {lp.knownPositionsVerified ? (
            <p className="text-emerald-900/90">
              {s.verifiedKnownPositions}
              {lp.exhaustiveDiscoveryComplete || lp.discoveryComplete
                ? ` · ${s.fullPositionDiscoveryComplete}`
                : ""}
            </p>
          ) : lp.exhaustiveDiscoveryComplete || lp.discoveryComplete ? (
            <p>{s.fullPositionDiscoveryComplete}</p>
          ) : null}
          {(lp.completenessWarning || !lp.discoveryComplete) && (
            <p className="text-red-800/90">
              {lp.completenessWarning || s.completenessWarning}
            </p>
          )}
          <p>
            {fill(s.poolDetected, {
              value: lp.poolDetected ? s.yes : s.no,
            })}
          </p>
          <p className="break-all font-mono">
            {s.poolId}: {lp.poolId ?? "—"}
          </p>
          <p>
            {s.poolManagerBal}:{" "}
            {lp.poolManagerBalanceFormatted
              ? Number(lp.poolManagerBalanceFormatted).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "—"}
            {lp.sizeWarning ? ` · ${s.thinSizeWarning}` : ""}
          </p>
          <p>{lp.ownershipRiskNote}</p>
          <p>{fill(s.ownershipEvidence, { level: lp.evidenceLevel })}</p>
          {lp.detail ? <p>{lp.detail}</p> : null}
          {lp.discoverySources && lp.discoverySources.length > 0 ? (
            <p>
              {fill(s.discovery, {
                sources: lp.discoverySources.join(" · "),
                count: lp.positions.length,
              })}
            </p>
          ) : null}
          {lp.positions.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {lp.positions.map((p) => (
                <li
                  key={`adv-${p.positionNftId}`}
                  className="rounded-xl bg-surface/60 px-3 py-3"
                >
                  <p className="font-[family-name:var(--font-anton)] tracking-[0.1em] text-gold-light">
                    {fill(s.positionNft, {
                      id: p.positionNftId,
                      state: p.lockStateDisplay,
                    })}
                  </p>
                  <p className="mt-1 break-all font-mono">
                    {s.owner}: {p.owner ?? "—"}
                    {p.ownerLabel ? ` (${p.ownerLabel})` : ""}
                  </p>
                  <p className="mt-1">
                    {fill(s.pairFee, {
                      pair: `${(p.currency0 ?? "—").slice(0, 8)}…/${(p.currency1 ?? "—").slice(0, 8)}…`,
                      fee: p.fee ?? "—",
                    })}
                    {p.poolId ? ` · poolId ${p.poolId.slice(0, 10)}…` : ""}
                  </p>
                  <p className="mt-1">
                    {s.locker}: {p.lockerName ?? "—"}
                    {p.unlockDateUtc ? ` · ${s.unlock} ${p.unlockDateUtc}` : ""}
                    {p.removableByEoa === true
                      ? ` · ${s.removableByEoa}`
                      : p.removableByEoa === false
                        ? ` · ${s.notEoaRemovable}`
                        : ""}
                  </p>
                  <p className="mt-1">
                    {s.range}:{" "}
                    {p.inRange == null
                      ? s.rangeUnknown
                      : p.inRange
                        ? s.inRange
                        : s.outOfRange}
                    {p.tickLower != null && p.tickUpper != null
                      ? ` · ${s.ticks} [${p.tickLower}, ${p.tickUpper})`
                      : ""}
                    {p.currentTick != null ? ` · ${s.current} ${p.currentTick}` : ""}
                    {p.liquidity ? ` · L=${p.liquidity}` : ""}
                  </p>
                  <p className="mt-1">
                    {s.source}: {p.dataSource} · {s.evidence}: {p.evidenceLevel}
                    {p.lockTxHash ? ` · ${s.lockTx} ${p.lockTxHash.slice(0, 10)}…` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
    </section>
  );
}

/** Locale-style whole-token amounts for Supply & Burn primary UI. */
function formatSupplyAmount(rawFormatted: string | null): string {
  if (rawFormatted == null || rawFormatted === "") return "—";
  const n = Number(rawFormatted);
  if (!Number.isFinite(n)) return rawFormatted;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function triStateLabel(
  s: ScanMessages,
  v: SupplyBurnTriState,
  stageState?: AnalysisStageState,
  pendingDeepPartial = false,
): string {
  if (v === "yes") return s.supplyBurnTriYes;
  if (v === "no") return s.supplyBurnTriNo;
  return deepMissingLabel(
    s,
    stageState,
    s.supplyBurnTriUnknown,
    pendingDeepPartial,
  );
}

function ScanInfoTooltip({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/70 text-[0.55rem] leading-none text-muted hover:border-gold-light hover:text-gold-light"
      title={text}
      aria-label={text}
    >
      i
    </button>
  );
}

function BurnFieldLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <dt className="inline-flex max-w-full flex-wrap items-center gap-1 text-muted">
      <span>{label}</span>
      <ScanInfoTooltip text={tooltip} />
    </dt>
  );
}

function HolderFieldLabel({
  label,
  tooltip,
  className = "text-xs uppercase tracking-[0.16em] text-muted",
}: {
  label: string;
  tooltip: string;
  className?: string;
}) {
  return (
    <dt className={`inline-flex max-w-full flex-wrap items-center gap-1 ${className}`}>
      <span>{label}</span>
      <ScanInfoTooltip text={tooltip} />
    </dt>
  );
}

function CreatorFieldLabel({
  label,
  tooltip,
  className = "text-xs uppercase tracking-[0.16em] text-muted",
}: {
  label: string;
  tooltip: string;
  className?: string;
}) {
  return (
    <dt className={`inline-flex max-w-full flex-wrap items-center gap-1 ${className}`}>
      <span>{label}</span>
      <ScanInfoTooltip text={tooltip} />
    </dt>
  );
}

function creatorMetricText(
  s: ScanMessages,
  display: CreatorMetricDisplay,
  collecting: boolean,
): { text: string; className: string } {
  if (collecting) {
    return { text: s.deepFieldCollecting, className: "text-muted" };
  }
  if (display.kind === "unavailable") {
    return { text: s.creatorUnavailableLabel, className: "text-muted" };
  }
  if (display.kind === "unknown") {
    return {
      text: s.creatorUnknownLabel,
      className: creatorUnknownToneClassName(),
    };
  }
  if (display.kind === "incomplete") {
    return {
      text: display.text,
      className: creatorIncompleteToneClassName(),
    };
  }
  return { text: display.text, className: "text-foreground" };
}

function formatBurnWindowAmount(
  s: ScanMessages,
  formatted: string | null,
  completeness: string,
  stageState?: AnalysisStageState,
  pendingDeepPartial = false,
): string {
  if (completeness !== "complete" || formatted == null) {
    return deepMissingLabel(
      s,
      stageState,
      s.supplyBurnIncomplete,
      pendingDeepPartial,
    );
  }
  return formatSupplyAmount(formatted);
}

function formatRelativeBurnAge(
  iso: string | null,
  locale: string,
): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const deltaSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale.startsWith("zh") ? "zh-TW" : "en", {
    numeric: "auto",
  });
  if (deltaSec < 60) return rtf.format(-deltaSec, "second");
  const mins = Math.floor(deltaSec / 60);
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.floor(mins / 60);
  if (hours < 48) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  return rtf.format(-days, "day");
}

function historicalStatusLabel(
  s: ScanMessages,
  status: "verified" | "partial" | "unknown",
  stageState?: AnalysisStageState,
  pendingDeepPartial = false,
): string {
  if (status === "verified") return s.supplyBurnStatusVerified;
  if (status === "partial") return s.supplyBurnStatusPartial;
  return deepMissingLabel(
    s,
    stageState,
    s.supplyBurnStatusUnknown,
    pendingDeepPartial,
  );
}

function SupplyBurnSection({
  sb,
  s,
  stageState,
  deepRunning = false,
  deepRetryCount = 0,
  moduleProgress = null,
}: {
  sb: SupplyBurnIntelligence;
  s: ScanMessages;
  stageState?: AnalysisStageState;
  /** True while Progressive Deep has not settled — burn `partial` may mean P2/P3 pending. */
  deepRunning?: boolean;
  deepRetryCount?: number;
  moduleProgress?: ReactNode;
}) {
  const { locale } = useLocale();
  // Fast sets burn=partial after P0/P1; P2/P3 still collect during Deep.
  const pendingDeepPartial = deepRunning && stageState === "partial";
  const analyzing = stageIsAnalyzing(stageState, pendingDeepPartial);
  const collecting = stageIsCollecting(stageState, pendingDeepPartial);
  const collectingElapsed = useCollectingElapsed(analyzing);
  const estimateExceeded = stageEstimateExceeded(
    collectingElapsed,
    DEEP_STAGE_ESTIMATE_MS.burn,
  );
  const etaCopy = collectingEtaMessage({
    exceeded: estimateExceeded,
    estimateLabel: s.burnEstimatedTime,
    stillAnalyzingLabel: s.deepAnalysisStillAnalyzing,
  });
  const pagesFetched = sb.burnActivity?.pagesFetched ?? 0;
  const transfersIndexed = sb.burnActivity?.transfersIndexed ?? 0;
  const showIndexProgress =
    analyzing &&
    hasTransferIndexProgress({ pagesFetched, transfersIndexed });
  const retryDisplay = deepRetryAttemptDisplay(deepRetryCount);
  const showRetry = analyzing && deepRetryCount > 0;
  const knownBurnedRaw =
    sb.knownBurnedSupplyRaw != null ? BigInt(sb.knownBurnedSupplyRaw) : null;
  const hasKnownBurn = knownBurnedRaw != null && knownBurnedRaw > 0n;
  const burnedAmt = formatSupplyAmount(sb.knownBurnedSupplyFormatted);
  const burnedPct = formatBurnedPctForDisplay(sb.burnedPctOfTotalSupply) ?? "—";
  const showRemaining =
    hasKnownBurn && sb.effectiveRemainingMethod === "total_minus_known_dead";
  const burnFunctionTone = burnTriStateClassName(sb.burnFunction);
  const automaticBurnTone = burnTriStateClassName(sb.automaticBurn);
  const adminTone = burnTriStateClassName(sb.privilegedBurn, {
    privilegedYes: true,
  });

  const activity = sb.burnActivity;
  const windowMap = Object.fromEntries(
    (activity?.windows ?? []).map((w) => [w.window, w]),
  );
  const w24 = windowMap["24h"];
  const w7 = windowMap["7d"];
  const w30 = windowMap["30d"];
  const wAll = windowMap["all"];
  const allComplete = wAll?.completeness === "complete";
  const lastBurnRel = formatRelativeBurnAge(activity?.lastBurnAt ?? null, locale);
  let lastBurnLabel = deepMissingLabel(
    s,
    stageState,
    s.supplyBurnLastBurnUnknown,
    pendingDeepPartial,
  );
  if (activity?.headIndexed && lastBurnRel) {
    lastBurnLabel = lastBurnRel;
  } else if (activity?.headIndexed && allComplete && !activity.lastBurnAt) {
    lastBurnLabel = s.supplyBurnLastBurnNever;
  } else if (activity?.headIndexed && !activity.lastBurnAt && !allComplete) {
    lastBurnLabel = deepMissingLabel(
      s,
      stageState,
      s.supplyBurnLastBurnUnknown,
      pendingDeepPartial,
    );
  }

  const reduction = sb.supplyReduction;
  const provenLabel =
    reduction?.historicalReductionStatus === "unknown" ||
    reduction?.provenSupplyReductionFormatted == null
      ? deepMissingLabel(
          s,
          stageState,
          s.supplyBurnIncomplete,
          pendingDeepPartial,
        )
      : formatSupplyAmount(reduction.provenSupplyReductionFormatted);

  return (
    <section className="gold-border rounded-2xl p-5 sm:p-6">
      <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
        {s.supplyBurn}
      </h2>
      {moduleProgress}
      {analyzing ? (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-amber-900">{s.burnCollecting}</p>
          <PixelStageSpinner label={s.burnAnalyzingLabel} />
          <p className="text-[0.65rem] leading-relaxed text-muted/80">
            {etaCopy}
          </p>
          {showIndexProgress ? (
            <p className="text-[0.65rem] leading-relaxed text-muted/75">
              {fill(s.deepCollectingProgress, {
                pages: pagesFetched,
                transfers: transfersIndexed,
              })}
            </p>
          ) : null}
          {showRetry ? (
            <p className="text-[0.65rem] leading-relaxed text-muted/70">
              {fill(s.deepCollectingRetry, {
                attempt: retryDisplay.attempt,
                max: retryDisplay.max,
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurnTotalSupply}</dt>
          <dd className="text-foreground">
            {formatSupplyAmount(sb.totalSupplyFormatted)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <BurnFieldLabel
            label={s.supplyBurnKnownBurned}
            tooltip={s.supplyBurnKnownBurnedTooltip}
          />
          <dd className="text-foreground">
            {burnedAmt} · {burnedPct}
          </dd>
        </div>
        {showRemaining ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <dt className="text-muted">{s.supplyBurnRemaining}</dt>
            <dd className="text-foreground">
              {formatSupplyAmount(sb.effectiveRemainingSupplyFormatted)}
            </dd>
          </div>
        ) : null}
      </dl>

      {!hasKnownBurn && knownBurnedRaw === 0n && !collecting ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {s.supplyBurnNoKnownBurn}
        </p>
      ) : null}

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <BurnFieldLabel
            label={s.supplyBurnFunction}
            tooltip={s.supplyBurnFunctionTooltip}
          />
          <dd className={burnFunctionTone}>
            {triStateLabel(s, sb.burnFunction, stageState, pendingDeepPartial)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <BurnFieldLabel
            label={s.supplyBurnAutomatic}
            tooltip={s.supplyBurnAutomaticTooltip}
          />
          <dd className={automaticBurnTone}>
            {triStateLabel(s, sb.automaticBurn, stageState, pendingDeepPartial)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <BurnFieldLabel
            label={s.supplyBurnPrivileged}
            tooltip={s.supplyBurnPrivilegedTooltip}
          />
          <dd className={adminTone}>
            {sb.privilegedBurn === "yes"
              ? s.supplyBurnPrivilegedYes
              : triStateLabel(
                  s,
                  sb.privilegedBurn,
                  stageState,
                  pendingDeepPartial,
                )}
          </dd>
        </div>
      </dl>

      <h3 className="mt-6 font-[family-name:var(--font-anton)] text-xs tracking-[0.14em] text-foreground sm:text-sm">
        {s.supplyBurnActivity}
      </h3>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurn24h}</dt>
          <dd className="text-foreground">
            {formatBurnWindowAmount(
              s,
              w24?.burnedToDeadFormatted ?? null,
              w24?.completeness ?? "unknown",
              stageState,
              pendingDeepPartial,
            )}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurn7d}</dt>
          <dd className="text-foreground">
            {formatBurnWindowAmount(
              s,
              w7?.burnedToDeadFormatted ?? null,
              w7?.completeness ?? "unknown",
              stageState,
              pendingDeepPartial,
            )}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurn30d}</dt>
          <dd className="text-foreground">
            {formatBurnWindowAmount(
              s,
              w30?.burnedToDeadFormatted ?? null,
              w30?.completeness ?? "unknown",
              stageState,
              pendingDeepPartial,
            )}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurnAllTimeKnown}</dt>
          <dd className="text-foreground">
            {formatBurnWindowAmount(
              s,
              wAll?.burnedToDeadFormatted ?? null,
              wAll?.completeness ?? "unknown",
              stageState,
              pendingDeepPartial,
            )}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurnLastBurn}</dt>
          <dd className="text-foreground">{lastBurnLabel}</dd>
        </div>
        {activity?.burnTransactionCount != null ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <dt className="text-muted">{s.supplyBurnTxCount}</dt>
            <dd className="text-foreground">
              {activity.burnTransactionCount.toLocaleString()}
            </dd>
          </div>
        ) : null}
      </dl>

      <h3 className="mt-6 font-[family-name:var(--font-anton)] text-xs tracking-[0.14em] text-foreground sm:text-sm">
        {s.supplyBurnReductionHeading}
      </h3>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurnDeadInventory}</dt>
          <dd className="text-foreground">{burnedAmt}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurnProvenReduction}</dt>
          <dd className="text-foreground">{provenLabel}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">{s.supplyBurnHistoricalStatus}</dt>
          <dd className="text-foreground">
            {historicalStatusLabel(
              s,
              reduction?.historicalReductionStatus ?? "unknown",
              stageState,
              pendingDeepPartial,
            )}
          </dd>
        </div>
      </dl>

      <details className="mt-5 border-t border-gold-light/20 pt-4">
        <summary className="cursor-pointer text-xs tracking-[0.08em] text-muted hover:text-foreground">
          {s.supplyBurnViewTechnicalDetails}
        </summary>
        <div className="mt-3 space-y-3 text-[0.7rem] leading-relaxed text-muted">
          <p>{s.supplyBurnDeadVsReduced}</p>
          {showRemaining ? <p>{s.supplyBurnRemainingFootnote}</p> : null}
          <p>
            {s.supplyBurnHolderBurn}:{" "}
            {triStateLabel(
              s,
              sb.holderBurnCallable,
              stageState,
              pendingDeepPartial,
            )}{" "}
            · {s.supplyBurnBurnFrom}:{" "}
            {triStateLabel(
              s,
              sb.burnFromPresent,
              stageState,
              pendingDeepPartial,
            )}
          </p>
          <p>
            {s.supplyBurnSupplyReduced}:{" "}
            {triStateLabel(
              s,
              sb.supplyReductionVerified,
              stageState,
              pendingDeepPartial,
            )}
          </p>
          {reduction?.note ? <p>{reduction.note}</p> : null}
          <p>
            {fill(s.supplyBurnAdvancedMethod, {
              method: sb.effectiveRemainingMethod,
            })}
          </p>
          <p>
            {fill(s.supplyBurnAdvancedMechanism, {
              mechanism: sb.burnMechanism,
            })}
          </p>
          <div>
            <p className="text-muted/80">{s.supplyBurnAdvancedDeadBalances}</p>
            {sb.deadAddressBalances.length === 0 ? (
              <p className="mt-1">—</p>
            ) : (
              <ul className="mt-1 list-inside list-disc font-mono">
                {sb.deadAddressBalances.map((b) => (
                  <li key={b.address}>
                    {truncateHolderAddress(b.address)}:{" "}
                    {formatSupplyAmount(b.balanceFormatted)}
                    {b.percentOfTotalSupply != null
                      ? ` (${b.percentOfTotalSupply.toFixed(2)}%)`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {sb.findings.length ? (
            <div>
              <p className="text-muted/80">{s.supplyBurnAdvancedFindings}</p>
              <ul className="mt-1 list-inside list-disc">
                {sb.findings.map((f) => (
                  <li key={f.code}>
                    [{f.severity}] {f.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {sb.dataCompletenessNotes.length ? (
            <div>
              <p className="text-muted/80">{s.supplyBurnAdvancedNotes}</p>
              <ul className="mt-1 list-inside list-disc">
                {sb.dataCompletenessNotes.map((n) => (
                  <li key={n.slice(0, 48)}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>{s.supplyBurnNoScoreBoost}</p>
        </div>
      </details>
    </section>
  );
}

function CreatorBehaviourSection({
  cb,
  s,
  deployer,
  creationTxHash,
  topHolders,
  contractRisk,
  relationship,
  stageState,
  deepRunning = false,
  deepRetryCount = 0,
  moduleProgress = null,
}: {
  cb: CreatorBehaviourResult;
  s: ScanMessages;
  deployer: string | null;
  creationTxHash: string | null;
  topHolders: LabeledHolder[];
  contractRisk: ContractRiskResult;
  relationship: WalletRelationshipSignals;
  stageState?: AnalysisStageState;
  /** True while Progressive Deep / retryable collection is still active. */
  deepRunning?: boolean;
  deepRetryCount?: number;
  moduleProgress?: ReactNode;
}) {
  const visual = creatorVisualStatus(cb);
  const dataStatus = creatorDataStatus(cb);
  const pendingDeepPartial = deepRunning && stageState === "partial";
  const analyzing = stageIsAnalyzing(stageState, pendingDeepPartial);
  const collecting = stageIsCollecting(stageState, pendingDeepPartial);
  const collectingElapsed = useCollectingElapsed(analyzing || collecting);
  const estimateExceeded = stageEstimateExceeded(
    collectingElapsed,
    DEEP_STAGE_ESTIMATE_MS.creator,
  );
  const etaCopy = collectingEtaMessage({
    exceeded: estimateExceeded,
    estimateLabel: s.creatorEstimatedTime,
    stillAnalyzingLabel: s.deepAnalysisStillAnalyzing,
  });
  const showIndexProgress =
    (analyzing || collecting) &&
    hasTransferIndexProgress({
      pagesFetched: cb.pagesFetched,
      transfersIndexed: cb.transfersIndexed,
    });
  const retryDisplay = deepRetryAttemptDisplay(deepRetryCount);
  const showRetry = (analyzing || collecting) && deepRetryCount > 0;
  // While Deep is still collecting, never show INSUFFICIENT DATA as a finished conclusion.
  const showCollectingStatus = collecting && visual === "insufficient";
  const transferThenSellValue =
    cb.transferThenSellDetected || cb.transferThenSellRecipientCount > 0
      ? fill(s.creatorTransferThenSellCount, {
          count: cb.transferThenSellRecipientCount,
        })
      : collecting
        ? s.deepFieldCollecting
        : s.creatorTransferThenSellNone;

  const identity = creatorIdentityState(deployer);
  const soldCount = creatorMetricText(
    s,
    describeCreatorSoldCountDisplay(cb),
    showCollectingStatus,
  );
  const soldPct = creatorMetricText(
    s,
    describeCreatorSoldPctDisplay(cb),
    showCollectingStatus,
  );
  const burned = creatorMetricText(
    s,
    describeCreatorBurnedDisplay(cb),
    showCollectingStatus,
  );
  const received = creatorMetricText(
    s,
    describeCreatorReceivedDisplay(),
    showCollectingStatus,
  );
  const transferred = creatorMetricText(
    s,
    describeCreatorTransferredDisplay(cb),
    showCollectingStatus,
  );
  const balance = creatorMetricText(
    s,
    describeCreatorBalanceDisplay({ deployer, topHolders }),
    showCollectingStatus,
  );
  const balancePct = creatorMetricText(
    s,
    describeCreatorBalancePctDisplay({ deployer, topHolders }),
    showCollectingStatus,
  );
  const proxyState = describeProxyPresentation(contractRisk.isProxy);
  const coverageIncomplete = isCreatorCoverageIncomplete(cb);
  const fundingWallet = relationship.sharedFundingFunder;

  return (
    <section className="gold-border rounded-2xl p-5 sm:p-6">
      <h2 className="inline-flex max-w-full flex-wrap items-center gap-1 font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
        <span>{s.creatorBehaviour}</span>
        <ScanInfoTooltip text={s.creatorActivityTooltip} />
      </h2>
      {moduleProgress}
      {analyzing ? (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-amber-900">{s.creatorCollecting}</p>
          <PixelStageSpinner label={s.creatorAnalyzingLabel} />
          <p className="text-[0.65rem] leading-relaxed text-muted/80">
            {etaCopy}
          </p>
          {showIndexProgress ? (
            <p className="text-[0.65rem] leading-relaxed text-muted/75">
              {fill(s.deepCollectingProgress, {
                pages: cb.pagesFetched,
                transfers: cb.transfersIndexed,
              })}
            </p>
          ) : null}
          {showRetry ? (
            <p className="text-[0.65rem] leading-relaxed text-muted/70">
              {fill(s.deepCollectingRetry, {
                attempt: retryDisplay.attempt,
                max: retryDisplay.max,
              })}
            </p>
          ) : null}
        </div>
      ) : null}
      <p
        className={`mt-3 font-[family-name:var(--font-anton)] text-sm tracking-[0.08em] sm:text-base ${
          showCollectingStatus ? "text-muted" : creatorStatusTone(visual)
        }`}
      >
        {showCollectingStatus
          ? s.creatorCollecting
          : creatorStatusLabel(s, visual)}
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <CreatorFieldLabel
            label={s.deployer}
            tooltip={s.creatorDeployerTooltip}
          />
          <dd
            className={`mt-1 break-all font-mono text-xs ${
              identity === "unknown"
                ? creatorUnknownToneClassName()
                : "text-foreground"
            }`}
          >
            {identity === "unknown" ? s.creatorUnknownLabel : deployer}
          </dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorAddressLabel}
            tooltip={s.creatorAddressTooltip}
          />
          <dd
            className={`mt-1 break-all font-mono text-xs ${
              identity === "unknown"
                ? creatorUnknownToneClassName()
                : "text-foreground"
            }`}
          >
            {identity === "unknown" ? s.creatorUnknownLabel : deployer}
          </dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorDeploymentSourceLabel}
            tooltip={s.creatorDeploymentSourceTooltip}
          />
          <dd className="mt-1 break-all font-mono text-xs text-foreground">
            {creationTxHash ?? s.creatorUnavailableLabel}
          </dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorCurrentOwnerLabel}
            tooltip={s.creatorCurrentOwnerTooltip}
          />
          <dd className="mt-1 text-muted">{s.creatorUnavailableLabel}</dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorProxyLabel}
            tooltip={s.creatorProxyTooltip}
          />
          <dd
            className={`mt-1 ${
              proxyState === "unknown"
                ? creatorUnknownToneClassName()
                : "text-foreground"
            }`}
          >
            {proxyState === "yes"
              ? s.creatorProxyYes
              : proxyState === "no"
                ? s.creatorProxyNo
                : s.creatorUnknownLabel}
          </dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorFundingWalletLabel}
            tooltip={s.creatorFundingWalletTooltip}
          />
          <dd className="mt-1 break-all font-mono text-xs text-foreground">
            {fundingWallet ?? s.creatorUnavailableLabel}
          </dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorBalanceLabel}
            tooltip={s.creatorBalanceTooltip}
          />
          <dd className={`mt-1 ${balance.className}`}>{balance.text}</dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorBalancePctLabel}
            tooltip={s.creatorBalanceTooltip}
          />
          <dd className={`mt-1 ${balancePct.className}`}>{balancePct.text}</dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorSoldLabel}
            tooltip={s.creatorSoldTooltip}
          />
          <dd className={`mt-1 ${soldCount.className}`}>{soldCount.text}</dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorSoldPctLabel}
            tooltip={s.creatorSoldTooltip}
          />
          <dd className={`mt-1 ${soldPct.className}`}>{soldPct.text}</dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorBurnedLabel}
            tooltip={s.creatorBurnedTooltip}
          />
          <dd className={`mt-1 ${burned.className}`}>{burned.text}</dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorReceivedLabel}
            tooltip={s.creatorReceivedTooltip}
          />
          <dd className={`mt-1 ${received.className}`}>{received.text}</dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorTransferredLabel}
            tooltip={s.creatorTransferredTooltip}
          />
          <dd className={`mt-1 ${transferred.className}`}>
            {transferred.text}
          </dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorTransferThenSell}
            tooltip={s.creatorActivityTooltip}
          />
          <dd className="mt-1 text-foreground">{transferThenSellValue}</dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={s.creatorTxAnalyzed}
            tooltip={s.creatorCoverageTooltip}
          />
          <dd className="mt-1 text-foreground">
            {showCollectingStatus
              ? s.deepFieldCollecting
              : cb.transfersIndexed}
          </dd>
        </div>
        <div>
          <CreatorFieldLabel
            label={
              coverageIncomplete
                ? s.creatorIncompleteLabel
                : s.creatorAvailableLabel
            }
            tooltip={
              coverageIncomplete
                ? s.creatorIncompleteTooltip
                : s.creatorAvailableTooltip
            }
          />
          <dd
            className={`mt-1 ${
              coverageIncomplete
                ? creatorIncompleteToneClassName()
                : "text-foreground"
            }`}
          >
            {cb.available
              ? s.creatorAdvancedAvailableYes
              : coverageIncomplete
                ? s.creatorIncompleteLabel
                : s.creatorAdvancedAvailableNo}
          </dd>
        </div>
      </dl>

      {showCollectingStatus ? (
        <div className="mt-4 space-y-1 text-xs leading-relaxed text-muted">
          <p>{etaCopy}</p>
          {showIndexProgress ? (
            <p className="text-muted/80">
              {fill(s.deepCollectingProgress, {
                pages: cb.pagesFetched,
                transfers: cb.transfersIndexed,
              })}
            </p>
          ) : null}
          {showRetry ? (
            <p className="text-muted/70">
              {fill(s.deepCollectingRetry, {
                attempt: retryDisplay.attempt,
                max: retryDisplay.max,
              })}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            {creatorExplain(s, visual)}
          </p>
          <p className="mt-2 text-xs text-muted">
            {fill(s.creatorDataStatus, {
              status: creatorDataStatusLabel(s, dataStatus),
            })}
          </p>
        </>
      )}
      <p className="mt-2 text-[0.7rem] leading-relaxed text-muted/80">{s.creatorDisclaimer}</p>

      <details className="mt-5 border-t border-gold-light/20 pt-4">
        <summary className="cursor-pointer text-xs tracking-[0.08em] text-muted hover:text-foreground">
          {s.creatorViewTechnicalDetails}
        </summary>
        <div className="mt-3 space-y-3 text-[0.7rem] leading-relaxed text-muted">
          <p>{fill(s.creatorAdvancedPages, { count: cb.pagesFetched })}</p>
          <p>{fill(s.creatorAdvancedTransfers, { count: cb.transfersIndexed })}</p>
          <p>{fill(s.creatorAdvancedOutbound, { count: cb.outboundTransferCount })}</p>
          <p>
            {s.creatorAdvancedPagination}:{" "}
            {cb.paginationComplete
              ? s.creatorAdvancedPaginationYes
              : s.creatorAdvancedPaginationNo}
          </p>
          <p>
            <span className="inline-flex items-center gap-1">
              {s.creatorAdvancedAvailable}
              <ScanInfoTooltip text={s.creatorAvailableTooltip} />
            </span>
            :{" "}
            {cb.available ? s.creatorAdvancedAvailableYes : s.creatorAdvancedAvailableNo}
          </p>
          <p>{fill(s.creatorAdvancedStatusRaw, { status: cb.status })}</p>
          <p>
            <span className="text-muted/80">{s.creatorAdvancedMethodology}</span>
          </p>
          {cb.detail ? (
            <div>
              <p className="text-muted/80">{s.creatorAdvancedEngineDetail}</p>
              <p className="mt-1">{cb.detail}</p>
            </div>
          ) : null}
          {cb.evidence.length > 0 ? (
            <div>
              <p className="text-muted/80">{s.creatorAdvancedEvidence}</p>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {cb.evidence.slice(0, 12).map((e, i) => (
                  <li
                    key={`${e.kind}-${e.txHash ?? i}-${e.to}`}
                    className="rounded-xl bg-surface/60 px-3 py-2 font-mono text-[0.65rem]"
                  >
                    <span className="uppercase tracking-[0.12em] text-gold-light">
                      {e.kind}
                    </span>
                    {" · "}
                    {e.pctOfSupply.toFixed(3)}% supply
                    {e.to ? ` · to ${e.to.slice(0, 10)}…` : ""}
                    {e.txHash ? ` · ${e.txHash.slice(0, 10)}…` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function deepStagesVisible(result: ScanResponse): boolean {
  if (!result.analysisStages) return false;
  if (
    result.analysisStatus === "complete" ||
    result.analysisPhase === "complete"
  ) {
    return false;
  }
  if (isDeepCollecting(result) || isDeepRetryable(result)) return true;
  if (
    result.analysisStatus === "partial" ||
    result.analysisStatus === "failed"
  ) {
    return true;
  }
  if (
    result.analysisPhase === "fast" ||
    result.analysisStatus === "deep_running"
  ) {
    return true;
  }
  if (result.scoreProvisional && result.analysisStatus === "fast_ready") {
    return true;
  }
  return Boolean(result.cache?.refreshing && result.analysisPhase === "fast");
}

function ScanResults({ result, s }: { result: ScanResponse; s: ScanMessages }) {
  const { overview, overall, score, activity, confidence } = result;
  const structural = result.structural ?? score;
  const hansomeLevel = result.hansomeLevel ?? toHansomeLevel(activity.level);
  const overallBand = overall ? getOverallScoreBand(overall.score) : null;
  const provisional = Boolean(result.scoreProvisional);
  const stages = result.analysisStages;
  const showDeepProgress = deepStagesVisible(result);
  // Collecting covers deep_running and retryable partial (not terminal gap).
  const deepRunning = showDeepProgress && isDeepCollecting(result);
  const workflow = useHonestWorkflowProgress(result);
  const overallBandTitle = [
    s.overallTooltip,
    "",
    s.overallBandLegendTitle,
    OVERALL_SCORE_BAND_LEGEND,
    "",
    s.overallBandLegendHint,
  ].join("\n");

  return (
    <div className="mt-10 space-y-6 text-left">
      {provisional ? (
        <p className="rounded-xl border border-amber-800/30 bg-amber-50/40 px-3 py-2 text-center text-[0.7rem] leading-relaxed text-amber-950 sm:text-xs">
          {s.scoreProvisionalNote}
        </p>
      ) : null}
      {overall && overallBand ? (
        <div
          className="gold-border rounded-2xl p-6 text-center sm:p-8"
          title={overallBandTitle}
        >
          <p className="flex items-center justify-center gap-1.5 text-[0.7rem] uppercase tracking-[0.24em] text-gold-light">
            <span>{s.overallScore}</span>
            {provisional ? (
              <span className="rounded border border-amber-800/40 px-1.5 py-0.5 text-[0.55rem] tracking-[0.14em] text-amber-950">
                {s.scoreProvisionalBadge}
              </span>
            ) : null}
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gold-light/50 text-[0.55rem] leading-none text-gold-light"
              title={overallBandTitle}
              aria-label={s.overallBandLegendTitle}
            >
              i
            </span>
          </p>
          <ScoreNumber
            spacingClass="mt-3"
            className={`font-[family-name:var(--font-anton)] text-5xl tracking-[0.08em] sm:text-6xl ${overallBand.textClass}`}
            animateValue={overall.score}
          />
          <p
            className={`mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.16em] sm:text-3xl ${overallBand.textClass}`}
          >
            {overallBand.label}
          </p>
          <p className="mx-auto mt-3 max-w-md text-[0.75rem] leading-relaxed text-muted">
            {result.uiWording.overallSubtitle ?? s.overallSubtitle}
          </p>
          {overall.components ? (
            <p className="mx-auto mt-3 max-w-lg text-[0.65rem] leading-relaxed text-muted/80">
              {fill(s.overallComponentsHint, {
                structural: overall.components.structural,
                liquidity: overall.components.liquidityDepth,
                holders: overall.components.holderAdoption,
                activity: overall.components.activity,
                maturity: overall.components.maturity,
                confidence: overall.components.dataConfidence,
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
        <TopScoreCard
          title={s.structuralTooltip}
          label={
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-gold-light">
              {s.structuralScore}
            </p>
          }
        >
          <div className="flex w-full flex-col items-center">
            <ScoreNumber
              spacingClass=""
              className={`font-[family-name:var(--font-anton)] text-3xl tracking-[0.08em] ${ScoreTone(structural.score)}`}
              animateValue={structural.score}
            />
            <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
              {result.uiWording.structuralSubtitle ??
                result.uiWording.scoreSubtitle}
            </p>
          </div>
        </TopScoreCard>
        <TopScoreCard
          title={s.hansomeLevelInfoBody}
          label={
            <p className="flex items-center justify-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-gold-light">
              <span>{s.hansomeLevel}</span>
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gold-light/50 text-[0.55rem] leading-none text-gold-light"
                title={`${s.hansomeLevelInfoTitle}\n\n${s.hansomeLevelInfoBody}`}
                aria-label={s.hansomeLevelInfoTitle}
              >
                i
              </span>
            </p>
          }
        >
          <div className="flex w-full flex-col items-center">
            <p className="text-4xl leading-none" aria-hidden="true">
              {hansomeLevel.emoji}
            </p>
            <p className="mt-2 font-[family-name:var(--font-anton)] text-xl tracking-[0.12em] text-foreground sm:text-2xl">
              {hansomeLevel.label}
            </p>
            <p className="mt-3 text-[0.75rem] leading-relaxed text-muted">
              {hansomeLevelDescription(s, hansomeLevel.id)}
            </p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-muted/80">
              {s.hansomeLevelBasis}
            </p>
            <p className="mt-3 text-[0.65rem] leading-relaxed text-muted">
              {fill(s.rawActivity, { level: activity.level })}
            </p>
            <p className="mt-1 text-[0.65rem] leading-relaxed text-muted">
              {fill(s.activitySource, { source: activity.source })}
            </p>
          </div>
        </TopScoreCard>
        <TopScoreCard
          label={
            <p
              className="text-[0.65rem] uppercase tracking-[0.22em] text-gold-light"
              title={s.confidenceTooltip}
            >
              {s.confidence}
            </p>
          }
        >
          <div className="flex w-full flex-col items-center">
            <ScoreNumber
              spacingClass=""
              className="font-[family-name:var(--font-anton)] text-3xl tracking-[0.08em] text-foreground"
              animateValue={confidence.percent}
              animateSuffix="%"
            />
            <p className="mt-1 text-[0.7rem] text-muted">
              {confidenceDimBand(s, confidence.band)}
            </p>
            <p className="mt-2 whitespace-pre-line text-[0.7rem] leading-relaxed text-muted">
              {s.confidenceSubtitle}
            </p>
          </div>
        </TopScoreCard>
      </div>

      {showDeepProgress ? (
        <AnalysisProgressPanel result={result} s={s} workflow={workflow} />
      ) : null}

      {confidence.dimensions?.length ? (
        <section className="gold-border rounded-2xl p-5 sm:p-6">
          <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
            {s.confidenceBreakdown}
          </h2>
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted">
            {s.confidenceSubtitle}
          </p>
          <ul className="mt-4 space-y-3">
            {confidence.dimensions.map((d) => {
              const label = confidenceDimLabel(s, d.id);
              const band = confidenceDimBand(s, d.band);
              const blurb = confidenceDimBlurb(s, d);
              const warnings = confidenceDimWarnings(s, d);
              return (
                <li
                  key={d.id}
                  className="rounded-xl bg-surface/60 px-3 py-3 text-sm"
                >
                  <p className="text-foreground">
                    {fill(s.confidenceDimLine, {
                      label,
                      band,
                      percent: d.score,
                    })}
                  </p>
                  {blurb ? (
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">
                      {blurb}
                    </p>
                  ) : null}
                  {warnings.map((w) => (
                    <p
                      key={w}
                      className="mt-1 text-[0.75rem] leading-relaxed text-amber-800/90"
                    >
                      ⚠️ {w}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>

          <details className="mt-5 border-t border-gold-light/20 pt-4">
            <summary className="cursor-pointer text-xs tracking-[0.08em] text-muted hover:text-foreground">
              {s.confidenceAdvancedDetails}
            </summary>
            <div className="mt-3 space-y-4 text-[0.7rem] leading-relaxed text-muted">
              <ul className="space-y-3">
                {confidence.dimensions.map((d) => (
                  <li key={`adv-${d.id}`} className="rounded-lg bg-surface/40 px-3 py-2">
                    <p className="font-medium text-foreground">
                      {confidenceDimLabel(s, d.id)}
                    </p>
                    <p className="mt-1">
                      {fill(s.confidenceAdvancedWeight, {
                        percent: Math.round(d.weight * 100),
                      })}
                    </p>
                    <p>
                      {s.confidenceAdvancedIncomplete}:{" "}
                      {d.incomplete
                        ? s.confidenceAdvancedIncompleteYes
                        : s.confidenceAdvancedIncompleteNo}
                    </p>
                    {d.evidence.length ? (
                      <div className="mt-1">
                        <p className="text-muted/80">{s.confidenceAdvancedEvidence}</p>
                        <ul className="mt-0.5 list-inside list-disc font-mono text-[0.65rem]">
                          {d.evidence.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {d.notes.length ? (
                      <div className="mt-1">
                        <p className="text-muted/80">{s.confidenceAdvancedNotes}</p>
                        <ul className="mt-0.5 list-inside list-disc">
                          {d.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {confidence.penalties?.length ? (
                <div>
                  <p className="text-muted/80">{s.confidenceAdvancedPenalties}</p>
                  <ul className="mt-1 list-inside list-disc">
                    {confidence.penalties.map((p) => (
                      <li key={`${p.code}-${p.dimension ?? ""}`}>
                        {p.code}
                        {p.dimension ? ` (${p.dimension})` : ""}: {p.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        </section>
      ) : null}

      <section className="gold-border rounded-2xl p-5 sm:p-6">
        <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
          {s.overview}
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">{s.name}</dt>
            <dd className="mt-1 text-foreground">
              {overview.name ?? "—"} ({overview.symbol ?? "—"})
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">{s.address}</dt>
            <dd className="mt-1 break-all font-mono text-xs text-foreground">{overview.address}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">{s.totalSupply}</dt>
            <dd className="mt-1 text-foreground">
              {overview.totalSupplyFormatted
                ? Number(overview.totalSupplyFormatted).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })
                : "—"}
            </dd>
          </div>
          <div>
            <HolderFieldLabel
              label={s.holders}
              tooltip={s.holderCoverageIncompleteTooltip}
            />
            <dd className="mt-1 text-foreground">{overview.holdersCount ?? "—"}</dd>
          </div>
          <div>
            <CreatorFieldLabel
              label={s.deployer}
              tooltip={s.creatorDeployerTooltip}
            />
            <dd
              className={`mt-1 break-all font-mono text-xs ${
                creatorIdentityState(overview.deployer) === "unknown"
                  ? creatorUnknownToneClassName()
                  : "text-foreground"
              }`}
            >
              {creatorIdentityState(overview.deployer) === "unknown"
                ? s.creatorUnknownLabel
                : overview.deployer}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">{s.poolManagerBalance}</dt>
            <dd className="mt-1 text-foreground">
              {overview.poolManagerBalanceFormatted
                ? Number(overview.poolManagerBalanceFormatted).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })
                : "—"}
            </dd>
          </div>
          <div>
            <HolderFieldLabel
              label={s.top10RawAdjusted}
              tooltip={s.holderConcentrationTooltip}
            />
            <dd className="mt-1 text-foreground">
              <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <span className="text-xs text-muted">{s.holderRawTop10Label}</span>
                  <ScanInfoTooltip text={s.holderIncludedInRawTooltip} />
                  <span>
                    {formatHolderPctForDisplay(
                      overview.concentration.top10RawPct,
                      1,
                    ) ?? "—"}
                  </span>
                </span>
                <span className="text-muted">/</span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-xs text-muted">
                    {s.holderAdjustedTop10Label}
                  </span>
                  <ScanInfoTooltip text={s.holderTop10Tooltip} />
                  <span>
                    {formatHolderPctForDisplay(
                      overview.concentration.top10AdjustedPct,
                      1,
                    ) ?? "—"}
                  </span>
                </span>
              </span>
              <span className="mt-1 block text-xs text-muted">
                {overview.totalSupplyRaw
                  ? s.holderDenominatorTotalSupply
                  : s.holderCoverageIncompleteTooltip}
              </span>
              <span className="mt-1 block text-xs text-muted">{s.adjustedNote}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">{s.contractRisk}</dt>
            <dd className="mt-1 text-foreground">
              {overview.contractRisk.status.toUpperCase()}
              <span className="mt-1 block text-xs text-muted">
                {overview.contractRisk.detail}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <SupplyBurnSection
        sb={overview.supplyBurn}
        s={s}
        stageState={stages?.burn}
        deepRunning={deepRunning}
        deepRetryCount={result.deepRetryCount ?? 0}
        moduleProgress={sectionModuleProgress(
          workflow,
          "burn",
          s,
          showDeepProgress &&
            (workflow.modules.find((m) => m.key === "burn")?.status !==
              "done"),
        )}
      />

      <LiquiditySection
        lp={overview.lpIntelligence}
        tokenSymbol={overview.symbol}
        tokenAddress={overview.address}
        liquidityUsd={result.liquidityUsd ?? null}
        s={s}
        stageState={stages?.liquidity}
        deepRunning={deepRunning}
        moduleProgress={sectionModuleProgress(
          workflow,
          "liquidity",
          s,
          showDeepProgress &&
            (workflow.modules.find((m) => m.key === "liquidity")?.status !==
              "done"),
        )}
      />

      <CreatorBehaviourSection
        cb={overview.creatorBehaviour}
        s={s}
        deployer={overview.deployer}
        creationTxHash={overview.creationTxHash}
        topHolders={overview.topHolders}
        contractRisk={overview.contractRisk}
        relationship={overview.relationship}
        stageState={stages?.creator}
        deepRunning={deepRunning}
        deepRetryCount={result.deepRetryCount ?? 0}
        moduleProgress={sectionModuleProgress(
          workflow,
          "creator",
          s,
          showDeepProgress &&
            (workflow.modules.find((m) => m.key === "creator")?.status !==
              "done"),
        )}
      />

      <section className="gold-border rounded-2xl p-5 sm:p-6">
        <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
          {s.deductions}
        </h2>
        {score.deductions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{s.noDeductions}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {score.deductions.map((d) => {
              const categoryLabel =
                s.deductionCategories[
                  d.category as keyof typeof s.deductionCategories
                ] ?? d.category;
              const signalLabel =
                s.deductionSignals[d.code as keyof typeof s.deductionSignals] ??
                d.code;
              return (
                <li
                  key={`${d.code}-${d.points}`}
                  className="rounded-xl bg-surface/60 px-3 py-3 text-sm text-foreground"
                >
                  <span className="font-[family-name:var(--font-anton)] text-xs tracking-[0.12em] text-gold-light">
                    <span className="inline-block whitespace-nowrap tracking-normal">
                      {`-${d.points}`}
                    </span>
                  </span>
                  <p className="mt-1 text-xs text-muted">
                    {s.deductionCategoryLabel}:{" "}
                    <span className="text-foreground">{categoryLabel}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.deductionSignalLabel}:{" "}
                    <span className="text-foreground">{signalLabel}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{d.reason}</p>
                </li>
              );
            })}
          </ul>
        )}
        {score.scoreCeilingApplied != null ? (
          <p className="mt-3 text-xs text-muted">
            {fill(s.scoreCeiling, { ceiling: score.scoreCeilingApplied })}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-muted">
          {s.categoryTotals} — {s.catContract}: {score.categoryTotals.contract_risk}/25 ·{" "}
          {s.catLpOwnership}: {score.categoryTotals.liquidity_ownership}/20 ·{" "}
          {s.catConcentration}: {score.categoryTotals.holder_concentration}/20 ·{" "}
          {s.catRelationships}: {score.categoryTotals.wallet_relationship}/15 · {s.catLaunch}:{" "}
          {score.categoryTotals.launch_fairness}/10 · {s.catCreator}:{" "}
          {score.categoryTotals.creator_behaviour}/10
        </p>
      </section>

      <section className="gold-border rounded-2xl p-5 sm:p-6">
        <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
          {s.riskFlags}
        </h2>
        <ul className="mt-3 space-y-2">
          {score.flags.map((f) => (
            <li key={f.code} className="rounded-xl bg-surface/60 px-3 py-3 text-sm">
              <span className="text-xs uppercase tracking-[0.16em] text-gold-light">
                {f.severity}
              </span>
              <p className="mt-1 leading-relaxed text-muted">{f.message}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="gold-border rounded-2xl p-5 sm:p-6">
        <h2 className="inline-flex max-w-full flex-wrap items-center gap-2 font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
          <span>{s.topHolders}</span>
          <ScanInfoTooltip text={s.holderTop10Tooltip} />
        </h2>
        {isHolderCoverageIncomplete({
          holdersCount: overview.holdersCount,
          totalSupplyRaw: overview.totalSupplyRaw,
          topHoldersLength: overview.topHolders.length,
        }) ? (
          <p className="mt-2 inline-flex max-w-full items-start gap-1 text-xs text-amber-900">
            <span>{s.holderCoverageIncompleteTooltip}</span>
            <ScanInfoTooltip text={s.holderCoverageIncompleteTooltip} />
          </p>
        ) : null}
        {stages?.relationships === "analyzing" ? (
          <PixelStageSpinner
            label={`${s.stageRelationships} · ${s.sectionAnalyzing}`}
          />
        ) : null}
        <ul className="mt-3 space-y-2">
          {overview.topHolders.slice(0, 10).map((h, idx) => {
            const labelParts = holderLabelParts(s, h.label);
            const labelLine = labelParts
              ? formatHolderLabelLine(labelParts)
              : null;
            const categoryTooltip = holderCategoryTooltipText(s, h.label);
            const pctDisplay =
              formatHolderPctForDisplay(h.percentOfSupply, 2) ?? "—";
            return (
              <li key={h.address} className="rounded-xl bg-surface/60 px-3 py-3">
                <div className="flex min-w-0 items-baseline gap-3 text-sm leading-5">
                  <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                    {idx + 1}. {truncateHolderAddress(h.address)}
                    {idx === 0 ? (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle font-sans text-[0.65rem] uppercase tracking-[0.12em] text-muted">
                        {s.holderLargestLabel}
                        <ScanInfoTooltip text={s.holderLargestTooltip} />
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {pctDisplay}
                  </span>
                </div>
                {labelLine ? (
                  <p
                    className={`mt-1 inline-flex min-w-0 max-w-full items-center gap-1 truncate text-xs leading-4 ${
                      labelParts?.unknown
                        ? holderUnknownToneClassName()
                        : "text-muted"
                    }`}
                  >
                    <span className="truncate">{labelLine}</span>
                    {categoryTooltip ? (
                      <ScanInfoTooltip text={categoryTooltip} />
                    ) : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {overview.topHolders.slice(0, 10).some((h) => h.excludedFromConcentration) ? (
          <details className="mt-5 border-t border-gold-light/20 pt-4">
            <summary className="cursor-pointer text-xs tracking-[0.08em] text-muted hover:text-foreground">
              {s.holdersAdvancedDetails}
            </summary>
            <ul className="mt-3 space-y-2 text-[0.7rem] leading-relaxed text-muted">
              {overview.topHolders
                .slice(0, 10)
                .filter((h) => h.excludedFromConcentration)
                .map((h) => {
                  const parts = holderLabelParts(s, h.label);
                  const labelBit = parts
                    ? ` · ${formatHolderLabelLine(parts)}`
                    : "";
                  return (
                    <li
                      key={`excl-${h.address}`}
                      className="inline-flex max-w-full flex-wrap items-center gap-1 font-mono"
                    >
                      <span>
                        {truncateHolderAddress(h.address)}
                        {labelBit} · {s.exclFromConcentration}
                      </span>
                      <ScanInfoTooltip
                        text={s.holderExcludedFromCirculatingTooltip}
                      />
                    </li>
                  );
                })}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="gold-border rounded-2xl p-5 sm:p-6">
        <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.16em] text-foreground sm:text-base">
          {s.dataSources}
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {result.sources.map((src) => (
            <li key={src.id} className="rounded-xl bg-surface/60 px-3 py-3">
              <span className="font-[family-name:var(--font-anton)] text-xs tracking-[0.12em] text-gold-light">
                {src.label}
                {src.affectsScore ? ` · ${s.affectsScore}` : ` · ${s.activityLabelsOnly}`}
              </span>
              <p className="mt-1 text-muted">{src.usedFor}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          {s.hansomeLevel}: {hansomeLevel.emoji} {hansomeLevel.label} ·{" "}
          {fill(s.rawActivity, { level: activity.level })} · {activity.note}
          {activity.volume24hUsd != null
            ? ` · vol24h ≈ $${Math.round(activity.volume24hUsd).toLocaleString()}`
            : ""}
          {activity.transactions24h != null ? ` · txs24h ≈ ${activity.transactions24h}` : ""}
          {activity.transfersCount != null
            ? ` · transfers (all-time counters) ≈ ${activity.transfersCount}`
            : ""}
        </p>
        <p className="mt-2 text-xs text-muted">
          {fill(s.lastUpdated, { when: formatScanWhen(result.scannedAt) })}
          {" · "}
          {fill(s.scannedAt, {
            when: formatScanWhen(result.scannedAt),
            version: result.version,
          })}
        </p>
      </section>

      <section className="rounded-2xl border border-border/50 px-4 py-5 text-left">
        <h2 className="font-[family-name:var(--font-anton)] text-xs tracking-[0.16em] text-muted">
          {s.disclaimers}
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[0.7rem] leading-relaxed text-muted/85 sm:text-xs">
          {result.disclaimers.map((d) => (
            <li key={d.slice(0, 24)}>{d}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
