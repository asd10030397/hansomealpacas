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
import { useLocale } from "@/context/LocaleContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  getExplorerAddressUrl,
  PERMIT2_ADDRESS,
  POOL_ID,
  ROBINHOOD_CHAIN_ID,
  STATE_VIEW_ADDRESS,
  UGLY_DECIMALS,
  UGLY_TOKEN_ADDRESS,
  UNIVERSAL_ROUTER_ADDRESS,
  robinhoodChain,
} from "@/lib/chain";
import { requestWatchUglyAsset } from "@/lib/wallet/watchAsset";
import { erc20Abi, permit2Abi, stateViewAbi, universalRouterAbi } from "@/lib/swap/abis";
import { buildUniversalRouterCalldata } from "@/lib/swap/encoding";
import { DEFAULT_SLIPPAGE_BPS, applySlippage, quoteFromPoolState } from "@/lib/swap/quote";

type SwapDirection = "ethToUgly" | "uglyToEth";

type SwapPhase = "idle" | "approvingToken" | "approvingPermit2" | "swapping";

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
  const [isWatchingAsset, setIsWatchingAsset] = useState(false);

  const [direction, setDirection] = useState<SwapDirection>("ethToUgly");
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
    () => parseAmountInput(debouncedAmount, direction === "ethToUgly" ? 18 : UGLY_DECIMALS),
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

  const { data: uglyBalance, refetch: refetchUglyBalance } = useReadContract({
    address: UGLY_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({
    address: UGLY_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, PERMIT2_ADDRESS] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) && direction === "uglyToEth" },
  });

  const { data: permit2Allowance, refetch: refetchPermit2Allowance } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: "allowance",
    args: address ? [address, UGLY_TOKEN_ADDRESS, UNIVERSAL_ROUTER_ADDRESS] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) && direction === "uglyToEth" },
  });

  const quoteOut = useMemo(() => {
    if (!parsedAmountIn || parsedAmountIn <= 0n || !slot0 || !poolLiquidity) return null;
    const [sqrtPriceX96] = slot0;
    if (sqrtPriceX96 <= 0n || poolLiquidity <= 0n) return null;
    return quoteFromPoolState(
      sqrtPriceX96,
      poolLiquidity,
      direction === "ethToUgly",
      parsedAmountIn,
    );
  }, [parsedAmountIn, slot0, poolLiquidity, direction]);

  const amountOutMin = useMemo(() => {
    if (!quoteOut) return null;
    return applySlippage(quoteOut, DEFAULT_SLIPPAGE_BPS);
  }, [quoteOut]);

  const formattedQuote = useMemo(() => {
    if (!quoteOut) return "—";
    return direction === "ethToUgly"
      ? formatUnits(quoteOut, UGLY_DECIMALS)
      : formatEther(quoteOut);
  }, [quoteOut, direction]);

  const needsTokenApproval =
    direction === "uglyToEth" &&
    parsedAmountIn !== null &&
    parsedAmountIn > 0n &&
    (tokenAllowance ?? 0n) < parsedAmountIn;

  const needsPermit2Approval =
    direction === "uglyToEth" &&
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
          args: [UGLY_TOKEN_ADDRESS, UNIVERSAL_ROUTER_ADDRESS, maxUint160, Number(expiration)],
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
        await Promise.all([refetchEthBalance(), refetchUglyBalance()]);
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
    refetchUglyBalance,
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
    setDirection((prev) => (prev === "ethToUgly" ? "uglyToEth" : "ethToUgly"));
    setAmountIn("");
  }, [resetTxState]);

  const handleWatchAsset = useCallback(async () => {
    resetTxState();

    if (!walletClient) {
      setTxPhase("failed");
      setTxMessage(t.swap.watchAssetFailed);
      console.warn("[UGLY] wallet_watchAsset skipped — wallet not connected");
      return;
    }

    setIsWatchingAsset(true);
    setTxPhase("loading");
    setTxMessage(t.swap.addToWallet);

    try {
      const added = await requestWatchUglyAsset(walletClient);
      setTxPhase(added ? "success" : "failed");
      setTxMessage(added ? t.swap.watchAssetSuccess : t.swap.watchAssetRejected);
    } catch (error) {
      console.error("[UGLY] wallet_watchAsset failed:", error);
      setTxPhase("failed");
      setTxMessage(t.swap.watchAssetFailed);
    } finally {
      setIsWatchingAsset(false);
    }
  }, [walletClient, resetTxState, t.swap.addToWallet, t.swap.watchAssetFailed, t.swap.watchAssetRejected, t.swap.watchAssetSuccess]);

  const handleSwap = useCallback(() => {
    if (!parsedAmountIn || parsedAmountIn <= 0n || !amountOutMin) return;
    resetTxState();

    if (direction === "uglyToEth" && needsTokenApproval) {
      setPendingAction("tokenApprove");
      setSwapPhase("approvingToken");
      setTxPhase("loading");
      setTxMessage(t.swap.status.approvingToken);
      writeContract({
        address: UGLY_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [PERMIT2_ADDRESS, maxUint256],
        chainId: ROBINHOOD_CHAIN_ID,
      });
      return;
    }

    if (direction === "uglyToEth" && needsPermit2Approval) {
      setPendingAction("permit2Approve");
      setSwapPhase("approvingPermit2");
      setTxPhase("loading");
      setTxMessage(t.swap.status.approvingPermit2);
      const expiration = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30);
      writeContract({
        address: PERMIT2_ADDRESS,
        abi: permit2Abi,
        functionName: "approve",
        args: [UGLY_TOKEN_ADDRESS, UNIVERSAL_ROUTER_ADDRESS, maxUint160, Number(expiration)],
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

  const inputSymbol = direction === "ethToUgly" ? "ETH" : "UGLY";
  const outputSymbol = direction === "ethToUgly" ? "UGLY" : "ETH";

  const balanceLabel =
    direction === "ethToUgly"
      ? ethBalance
        ? `${formatEther(ethBalance.value)} ETH`
        : "—"
      : uglyBalance !== undefined
        ? `${formatUnits(uglyBalance, UGLY_DECIMALS)} UGLY`
        : "—";

  const primaryLabel = !isConnected
    ? t.swap.connectWallet
    : isWrongChain
      ? t.swap.switchNetwork
      : swapPhase === "approvingToken"
        ? t.swap.approveUgly
        : swapPhase === "approvingPermit2"
          ? t.swap.approveRouter
          : swapPhase === "swapping"
            ? t.swap.swapping
            : direction === "uglyToEth" && needsTokenApproval
              ? t.swap.approveUgly
              : direction === "uglyToEth" && needsPermit2Approval
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

  const explorerUrl = getExplorerAddressUrl(UGLY_TOKEN_ADDRESS);

  return (
    <div className="gold-border w-full max-w-lg rounded-3xl bg-white/[0.02] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.35em] text-gold">
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
            <span className="font-[family-name:var(--font-anton)] text-sm tracking-[0.15em] text-gold">
              {inputSymbol}
            </span>
          </div>
        </div>

        <div className="flex justify-center">
          <m.button
            type="button"
            onClick={handleFlip}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full border border-gold/35 bg-gold/5 px-4 py-2 font-[family-name:var(--font-anton)] text-xs tracking-[0.2em] text-gold-light transition-colors hover:border-gold/55"
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
            <span className="font-[family-name:var(--font-anton)] text-sm tracking-[0.15em] text-gold">
              {outputSymbol}
            </span>
          </div>
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
        className={`mt-6 w-full border px-6 py-4 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] transition-all ${
          canSubmit || !isConnected || isWrongChain
            ? "cursor-pointer border-gold/40 bg-gradient-to-b from-gold/20 to-gold/5 text-gold-light hover:border-gold/60"
            : "cursor-default border-border text-muted opacity-70"
        }`}
      >
        {primaryLabel}
      </m.button>

      <TxStatusBanner phase={txPhase} message={txMessage} txHash={txHash} />

      <div className="mt-8 border-t border-border/80 pt-6">
        <div className="flex items-center gap-3">
          <TokenIcon symbol="UGLY" size={48} />
          <div>
            <p className="font-[family-name:var(--font-anton)] text-sm tracking-[0.15em] text-foreground">
              UGLY DEER
            </p>
            <p className="font-mono text-xs text-muted">{shortenAddress(UGLY_TOKEN_ADDRESS)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <CopyButton value={UGLY_TOKEN_ADDRESS} variant="gold" showAddress={false} />
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center border border-gold/35 bg-gold/5 px-8 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.18em] text-gold-light transition-all duration-200 hover:border-gold/55"
          >
            {t.swap.viewOnBlockscout}
          </a>
          <m.button
            type="button"
            onClick={() => void handleWatchAsset()}
            disabled={isWatchingAsset}
            whileHover={{ opacity: 0.9 }}
            className="inline-flex items-center justify-center border border-border px-8 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.18em] text-foreground transition-all duration-200 hover:border-gold/35"
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
