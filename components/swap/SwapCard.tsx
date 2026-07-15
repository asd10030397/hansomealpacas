"use client";

import { m } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEther, formatUnits, parseEther, parseUnits, maxUint256, maxUint160 } from "viem";
import {
  useBalance,
  useChainId,
  useConnect,
  useConnection,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { CopyButton } from "@/components/CopyButton";
import { TokenIcon } from "@/components/swap/TokenIcon";
import { TxStatusBanner, type TxPhase } from "@/components/swap/TxStatusBanner";
import { PROJECT } from "@/content/project";
import { useLocale } from "@/context/LocaleContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMarketStats } from "@/hooks/useMarketStats";
import {
  getExplorerAddressUrl,
  PERMIT2_ADDRESS,
  POOL_ID,
  ROBINHOOD_CHAIN_ID,
  STATE_VIEW_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_ADDRESS,
  UNIVERSAL_ROUTER_ADDRESS,
  robinhoodChain,
} from "@/lib/chain";
import { formatUsd } from "@/lib/market/format";
import { requestWatchTokenAsset } from "@/lib/wallet/watchAsset";
import { erc20Abi, permit2Abi, stateViewAbi, universalRouterAbi } from "@/lib/swap/abis";
import { buildUniversalRouterCalldata } from "@/lib/swap/encoding";
import { DEFAULT_SLIPPAGE_BPS, applySlippage, quoteFromPoolState } from "@/lib/swap/quote";

type SwapDirection = "ethToToken" | "tokenToEth";

type SwapPhase = "idle" | "approvingToken" | "approvingPermit2" | "swapping";

// Reserved so a 100%/MAX fill when paying with ETH still leaves enough ETH
// in the wallet to cover the swap's own gas cost — filling the literal full
// balance would otherwise make the transaction fail from insufficient funds.
// Named constant so this can be tuned later without touching the calc below.
const ETH_GAS_RESERVE_WEI = parseEther("0.001");

const AMOUNT_PERCENT_PRESETS = [25, 50, 70, 100] as const;

function parseAmountInput(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return decimals === 18 ? parseEther(trimmed) : parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function SwapCard() {
  const { t } = useLocale();
  const { address, isConnected } = useConnection();
  const chainId = useChainId();
  const { connectors, connect, isPending: isConnecting, error: connectError } = useConnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { data: marketData } = useMarketStats();
  const [isWatchingAsset, setIsWatchingAsset] = useState(false);

  const [direction, setDirection] = useState<SwapDirection>("ethToToken");
  const [amountIn, setAmountIn] = useState("");
  const [swapPhase, setSwapPhase] = useState<SwapPhase>("idle");
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const [txMessage, setTxMessage] = useState<string | undefined>();
  const [txHash, setTxHash] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<"tokenApprove" | "permit2Approve" | "swap" | null>(
    null,
  );
  const lastHandledHash = useRef<string | null>(null);

  const debouncedAmount = useDebouncedValue(amountIn);
  const isWrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;

  const parsedAmountIn = useMemo(
    () => parseAmountInput(debouncedAmount, direction === "ethToToken" ? 18 : TOKEN_DECIMALS),
    [debouncedAmount, direction],
  );

  const { data: slot0 } = useReadContract({
    address: STATE_VIEW_ADDRESS,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [POOL_ID],
    chainId: ROBINHOOD_CHAIN_ID,
  });

  const { data: poolLiquidity } = useReadContract({
    address: STATE_VIEW_ADDRESS,
    abi: stateViewAbi,
    functionName: "getLiquidity",
    args: [POOL_ID],
    chainId: ROBINHOOD_CHAIN_ID,
  });

  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({
    address,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, PERMIT2_ADDRESS] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) && direction === "tokenToEth" },
  });

  const { data: permit2Allowance, refetch: refetchPermit2Allowance } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: "allowance",
    args: address ? [address, TOKEN_ADDRESS, UNIVERSAL_ROUTER_ADDRESS] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) && direction === "tokenToEth" },
  });

  const quoteOut = useMemo(() => {
    if (!parsedAmountIn || parsedAmountIn <= 0n || !slot0 || !poolLiquidity) return null;
    const [sqrtPriceX96] = slot0;
    if (sqrtPriceX96 <= 0n || poolLiquidity <= 0n) return null;
    return quoteFromPoolState(
      sqrtPriceX96,
      poolLiquidity,
      direction === "ethToToken",
      parsedAmountIn,
    );
  }, [parsedAmountIn, slot0, poolLiquidity, direction]);

  const amountOutMin = useMemo(() => {
    if (!quoteOut) return null;
    return applySlippage(quoteOut, DEFAULT_SLIPPAGE_BPS);
  }, [quoteOut]);

  const formattedQuote = useMemo(() => {
    if (!quoteOut) return "—";
    return direction === "ethToToken"
      ? formatUnits(quoteOut, TOKEN_DECIMALS)
      : formatEther(quoteOut);
  }, [quoteOut, direction]);

  const needsTokenApproval =
    direction === "tokenToEth" &&
    parsedAmountIn !== null &&
    parsedAmountIn > 0n &&
    (tokenAllowance ?? 0n) < parsedAmountIn;

  const needsPermit2Approval =
    direction === "tokenToEth" &&
    parsedAmountIn !== null &&
    parsedAmountIn > 0n &&
    (permit2Allowance?.[0] ?? 0n) < parsedAmountIn;

  const {
    writeContract,
    data: writeHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: writeHash,
    chainId: ROBINHOOD_CHAIN_ID,
  });

  const resetTxState = useCallback(() => {
    setTxPhase("idle");
    setTxMessage(undefined);
    setTxHash(undefined);
    setSwapPhase("idle");
    setPendingAction(null);
    lastHandledHash.current = null;
    resetWrite();
  }, [resetWrite]);

  useEffect(() => {
    if (!writeHash) return;
    setTxHash(writeHash);
    if (isConfirming) {
      setTxPhase("loading");
      setTxMessage(t.swap.status.confirming);
    }
  }, [writeHash, isConfirming, t.swap.status.confirming]);

  useEffect(() => {
    if (!isConfirmed || !writeHash || !pendingAction) return;
    if (lastHandledHash.current === writeHash) return;
    lastHandledHash.current = writeHash;

    void (async () => {
      if (pendingAction === "tokenApprove") {
        await refetchTokenAllowance();
        setPendingAction("permit2Approve");
        setSwapPhase("approvingPermit2");
        setTxPhase("loading");
        setTxMessage(t.swap.status.approvingPermit2);
        const expiration = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30);
        writeContract({
          address: PERMIT2_ADDRESS,
          abi: permit2Abi,
          functionName: "approve",
          args: [TOKEN_ADDRESS, UNIVERSAL_ROUTER_ADDRESS, maxUint160, Number(expiration)],
          chainId: ROBINHOOD_CHAIN_ID,
        });
        return;
      }

      if (pendingAction === "permit2Approve") {
        await refetchPermit2Allowance();
        if (!parsedAmountIn || !amountOutMin) return;

        setPendingAction("swap");
        setSwapPhase("swapping");
        setTxPhase("loading");
        setTxMessage(t.swap.status.swapping);

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
        const calldata = buildUniversalRouterCalldata(
          direction,
          parsedAmountIn,
          amountOutMin,
          deadline,
        );

        writeContract({
          address: UNIVERSAL_ROUTER_ADDRESS,
          abi: universalRouterAbi,
          functionName: "execute",
          args: [calldata.commands, calldata.inputs, calldata.deadline],
          value: calldata.value,
          chainId: ROBINHOOD_CHAIN_ID,
        });
        return;
      }

      if (pendingAction === "swap") {
        setPendingAction(null);
        setSwapPhase("idle");
        setTxPhase("success");
        setTxMessage(t.swap.status.swapComplete);
        await Promise.all([refetchEthBalance(), refetchTokenBalance()]);
        setAmountIn("");
      }
    })();
  }, [
    isConfirmed,
    writeHash,
    pendingAction,
    parsedAmountIn,
    amountOutMin,
    direction,
    writeContract,
    refetchTokenAllowance,
    refetchPermit2Allowance,
    refetchEthBalance,
    refetchTokenBalance,
    t.swap.status.approvingPermit2,
    t.swap.status.swapping,
    t.swap.status.swapComplete,
  ]);

  useEffect(() => {
    if (!writeError) return;
    setSwapPhase("idle");
    setPendingAction(null);
    setTxPhase("failed");
    setTxMessage(writeError.message);
  }, [writeError]);

  useEffect(() => {
    if (!connectError) return;
    setTxPhase("failed");
    setTxMessage(connectError.message);
  }, [connectError]);

  const handleConnect = useCallback(() => {
    resetTxState();
    const connector = connectors[0];
    if (!connector) return;
    connect({ connector, chainId: ROBINHOOD_CHAIN_ID });
  }, [connect, connectors, resetTxState]);

  const handleSwitchChain = useCallback(() => {
    resetTxState();
    switchChain({ chainId: ROBINHOOD_CHAIN_ID });
  }, [switchChain, resetTxState]);

  const handleFlip = useCallback(() => {
    resetTxState();
    setDirection((prev) => (prev === "ethToToken" ? "tokenToEth" : "ethToToken"));
    setAmountIn("");
  }, [resetTxState]);

  const handleWatchAsset = useCallback(async () => {
    resetTxState();

    if (!walletClient) {
      setTxPhase("failed");
      setTxMessage(t.swap.watchAssetFailed);
      console.warn(`[${PROJECT.symbol}] wallet_watchAsset skipped — wallet not connected`);
      return;
    }

    setIsWatchingAsset(true);
    setTxPhase("loading");
    setTxMessage(t.swap.addToWallet);

    try {
      const added = await requestWatchTokenAsset(walletClient);
      setTxPhase(added ? "success" : "failed");
      setTxMessage(added ? t.swap.watchAssetSuccess : t.swap.watchAssetRejected);
    } catch (error) {
      console.error(`[${PROJECT.symbol}] wallet_watchAsset failed:`, error);
      setTxPhase("failed");
      setTxMessage(t.swap.watchAssetFailed);
    } finally {
      setIsWatchingAsset(false);
    }
  }, [walletClient, resetTxState, t.swap.addToWallet, t.swap.watchAssetFailed, t.swap.watchAssetRejected, t.swap.watchAssetSuccess]);

  const handleSwap = useCallback(() => {
    if (!parsedAmountIn || parsedAmountIn <= 0n || !amountOutMin) return;
    resetTxState();

    if (direction === "tokenToEth" && needsTokenApproval) {
      setPendingAction("tokenApprove");
      setSwapPhase("approvingToken");
      setTxPhase("loading");
      setTxMessage(t.swap.status.approvingToken);
      writeContract({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [PERMIT2_ADDRESS, maxUint256],
        chainId: ROBINHOOD_CHAIN_ID,
      });
      return;
    }

    if (direction === "tokenToEth" && needsPermit2Approval) {
      setPendingAction("permit2Approve");
      setSwapPhase("approvingPermit2");
      setTxPhase("loading");
      setTxMessage(t.swap.status.approvingPermit2);
      const expiration = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30);
      writeContract({
        address: PERMIT2_ADDRESS,
        abi: permit2Abi,
        functionName: "approve",
        args: [TOKEN_ADDRESS, UNIVERSAL_ROUTER_ADDRESS, maxUint160, Number(expiration)],
        chainId: ROBINHOOD_CHAIN_ID,
      });
      return;
    }

    setPendingAction("swap");
    setSwapPhase("swapping");
    setTxPhase("loading");
    setTxMessage(t.swap.status.swapping);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const calldata = buildUniversalRouterCalldata(
      direction,
      parsedAmountIn,
      amountOutMin,
      deadline,
    );

    writeContract({
      address: UNIVERSAL_ROUTER_ADDRESS,
      abi: universalRouterAbi,
      functionName: "execute",
      args: [calldata.commands, calldata.inputs, calldata.deadline],
      value: calldata.value,
      chainId: ROBINHOOD_CHAIN_ID,
    });
  }, [
    parsedAmountIn,
    amountOutMin,
    direction,
    needsTokenApproval,
    needsPermit2Approval,
    resetTxState,
    writeContract,
    t.swap.status.approvingToken,
    t.swap.status.approvingPermit2,
    t.swap.status.swapping,
  ]);

  const isBusy =
    isConnecting ||
    isSwitching ||
    isWritePending ||
    isConfirming ||
    swapPhase !== "idle" ||
    isWatchingAsset;

  const inputSymbol = direction === "ethToToken" ? "ETH" : PROJECT.symbol;
  const outputSymbol = direction === "ethToToken" ? PROJECT.symbol : "ETH";

  // HANSOME/USD comes straight from the market API; ETH/USD is derived from
  // the same response (priceUsd / priceEth = USD per 1 ETH) so both sides of
  // the swap stay consistent with a single data source and no extra fetch.
  const ethUsdPrice =
    marketData && marketData.priceEth > 0 ? marketData.priceUsd / marketData.priceEth : null;

  const payUsdValue = useMemo(() => {
    const amountNum = Number(amountIn);
    if (!marketData || !Number.isFinite(amountNum) || amountNum <= 0) return null;
    const unitPriceUsd = inputSymbol === "ETH" ? ethUsdPrice : marketData.priceUsd;
    if (unitPriceUsd === null || !Number.isFinite(unitPriceUsd)) return null;
    return amountNum * unitPriceUsd;
  }, [amountIn, marketData, inputSymbol, ethUsdPrice]);

  const receiveUsdValue = useMemo(() => {
    const amountNum = Number(formattedQuote);
    if (!marketData || !Number.isFinite(amountNum) || amountNum <= 0) return null;
    const unitPriceUsd = outputSymbol === "ETH" ? ethUsdPrice : marketData.priceUsd;
    if (unitPriceUsd === null || !Number.isFinite(unitPriceUsd)) return null;
    return amountNum * unitPriceUsd;
  }, [formattedQuote, marketData, outputSymbol, ethUsdPrice]);

  const balanceLabel =
    direction === "ethToToken"
      ? ethBalance
        ? `${formatEther(ethBalance.value)} ETH`
        : "—"
      : tokenBalance !== undefined
        ? `${formatUnits(tokenBalance, TOKEN_DECIMALS)} ${PROJECT.symbol}`
        : "—";

  const inputDecimals = direction === "ethToToken" ? 18 : TOKEN_DECIMALS;

  // Balance actually available to fill from, for the asset currently being
  // paid with. For ETH this subtracts the gas reserve above; for HANSOME the
  // full on-chain balance is usable since no gas buffer applies to it.
  const availableBalanceWei = useMemo(() => {
    if (!address) return null;
    if (inputSymbol === "ETH") {
      if (!ethBalance) return null;
      return ethBalance.value > ETH_GAS_RESERVE_WEI ? ethBalance.value - ETH_GAS_RESERVE_WEI : 0n;
    }
    return tokenBalance ?? null;
  }, [address, inputSymbol, ethBalance, tokenBalance]);

  const percentButtonsDisabled =
    !isConnected || availableBalanceWei === null || availableBalanceWei <= 0n;

  const handleFillPercent = useCallback(
    (percent: number) => {
      if (availableBalanceWei === null || availableBalanceWei <= 0n) return;
      // Integer bigint math only — never touches floating point, so there's
      // no rounding drift and the result can never exceed the wallet balance.
      const amountWei = (availableBalanceWei * BigInt(percent)) / 100n;
      if (amountWei <= 0n) return;
      resetTxState();
      setAmountIn(
        inputDecimals === 18 ? formatEther(amountWei) : formatUnits(amountWei, inputDecimals),
      );
    },
    [availableBalanceWei, inputDecimals, resetTxState],
  );

  const primaryLabel = !isConnected
    ? t.swap.connectWallet
    : isWrongChain
      ? t.swap.switchNetwork
      : swapPhase === "approvingToken"
        ? t.swap.approveToken
        : swapPhase === "approvingPermit2"
          ? t.swap.approveRouter
          : swapPhase === "swapping"
            ? t.swap.swapping
            : direction === "tokenToEth" && needsTokenApproval
              ? t.swap.approveToken
              : direction === "tokenToEth" && needsPermit2Approval
                ? t.swap.approveRouter
                : t.swap.swap;

  const canSubmit =
    isConnected &&
    !isWrongChain &&
    parsedAmountIn !== null &&
    parsedAmountIn > 0n &&
    quoteOut !== null &&
    quoteOut > 0n &&
    !isBusy;

  const handlePrimary = !isConnected
    ? handleConnect
    : isWrongChain
      ? handleSwitchChain
      : handleSwap;

  const explorerUrl = getExplorerAddressUrl(TOKEN_ADDRESS);

  return (
    <div className="gold-border w-full max-w-lg rounded-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.35em] text-gold-light">
            {t.swap.eyebrow}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-[0.12em] text-foreground sm:text-3xl">
            {t.swap.title}
          </h1>
        </div>
        {isConnected && address ? (
          <p className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted">
            {shortenAddress(address)}
          </p>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-muted">{t.swap.subtitle}</p>

      <div className="mt-6 space-y-3">
        <div className="tokenomics-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs tracking-[0.2em] text-muted" htmlFor="swap-amount-in">
              {t.swap.youPay}
            </label>
            <span className="text-xs text-muted">
              {t.swap.balance}: {balanceLabel}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5 sm:gap-2">
            {AMOUNT_PERCENT_PRESETS.map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => handleFillPercent(percent)}
                disabled={percentButtonsDisabled}
                aria-label={
                  percent === 100
                    ? `${t.swap.fillMax} (100%)`
                    : `${t.swap.fillPercent} ${percent}%`
                }
                className={`rounded-lg border px-1 py-1.5 font-[family-name:var(--font-anton)] text-[11px] leading-none tracking-[0.05em] ${
                  percentButtonsDisabled
                    ? "cursor-default border-border bg-surface text-muted opacity-50"
                    : "pixel-btn cursor-pointer border-wood bg-gold/15 text-gold-light hover:bg-gold/25 active:bg-gold/35"
                }`}
              >
                {percent === 100 ? (
                  <span className="flex flex-col items-center gap-0.5">
                    <span>100%</span>
                    <span className="text-[8px] tracking-[0.15em] opacity-70">MAX</span>
                  </span>
                ) : (
                  `${percent}%`
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <TokenIcon symbol={inputSymbol} size={36} />
            <input
              id="swap-amount-in"
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amountIn}
              onChange={(event) => {
                resetTxState();
                setAmountIn(event.target.value);
              }}
              className="min-w-0 flex-1 bg-transparent text-right font-[family-name:var(--font-anton)] text-2xl tracking-wide text-foreground outline-none placeholder:text-muted/40"
            />
            <span className="font-[family-name:var(--font-anton)] text-sm tracking-[0.15em] text-gold-light">
              {inputSymbol}
            </span>
          </div>
          <p className="mt-1 text-right text-xs tabular-nums text-muted">
            ≈ {payUsdValue !== null ? formatUsd(payUsdValue) : "—"}
          </p>
        </div>

        <div className="flex justify-center">
          <m.button
            type="button"
            onClick={handleFlip}
            whileTap={{ scale: 0.96 }}
            className="pixel-btn rounded-full border-wood bg-gold/20 px-4 py-2 font-[family-name:var(--font-anton)] text-xs tracking-[0.2em] text-gold-light"
            aria-label={t.swap.flipDirection}
          >
            ↕
          </m.button>
        </div>

        <div className="tokenomics-card rounded-2xl p-4">
          <p className="text-xs tracking-[0.2em] text-muted">{t.swap.youReceive}</p>
          <div className="mt-3 flex items-center gap-3">
            <TokenIcon symbol={outputSymbol} size={36} />
            <p className="min-w-0 flex-1 text-right font-[family-name:var(--font-anton)] text-2xl tracking-wide text-foreground">
              {formattedQuote}
            </p>
            <span className="font-[family-name:var(--font-anton)] text-sm tracking-[0.15em] text-gold-light">
              {outputSymbol}
            </span>
          </div>
          <p className="mt-1 text-right text-xs tabular-nums text-muted">
            ≈ {receiveUsdValue !== null ? formatUsd(receiveUsdValue) : "—"}
          </p>
          <p className="mt-2 text-right text-xs text-muted">
            {t.swap.slippage}: {(DEFAULT_SLIPPAGE_BPS / 100).toFixed(2)}%
          </p>
        </div>
      </div>

      <m.button
        type="button"
        onClick={handlePrimary}
        disabled={isConnected && !isWrongChain && !canSubmit}
        whileHover={canSubmit || !isConnected || isWrongChain ? { opacity: 0.92 } : undefined}
        className={`mt-6 w-full border px-6 py-4 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] ${
          canSubmit || !isConnected || isWrongChain
            ? "pixel-btn cursor-pointer border-wood bg-gradient-to-b from-gold-pale to-gold text-wood-dark"
            : "cursor-default border-border bg-surface text-muted opacity-70"
        }`}
      >
        {primaryLabel}
      </m.button>

      <TxStatusBanner phase={txPhase} message={txMessage} txHash={txHash} />

      <div className="mt-8 border-t border-border/80 pt-6">
        <div className="flex items-center gap-3">
          <TokenIcon symbol={PROJECT.symbol} size={48} />
          <div>
            <p className="font-[family-name:var(--font-anton)] text-sm tracking-[0.15em] text-foreground">
              {PROJECT.name}
            </p>
            <p className="font-mono text-xs text-muted">{shortenAddress(TOKEN_ADDRESS)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <CopyButton value={TOKEN_ADDRESS} variant="gold" showAddress={false} />
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-btn inline-flex items-center justify-center border-wood bg-gold/20 px-8 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.18em] text-gold-light"
          >
            {t.swap.viewOnBlockscout}
          </a>
          <m.button
            type="button"
            onClick={() => void handleWatchAsset()}
            disabled={isWatchingAsset}
            className="pixel-btn inline-flex items-center justify-center border-wood bg-surface px-8 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.18em] text-foreground"
          >
            {t.swap.addToWallet}
          </m.button>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          {t.swap.network}: {robinhoodChain.name} ({ROBINHOOD_CHAIN_ID})
        </p>
      </div>
    </div>
  );
}
