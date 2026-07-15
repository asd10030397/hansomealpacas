import { Telegraf } from "telegraf";
import { config } from "./config";
import { createLogger } from "./logger";
import { formatEth, formatTokenAmount, formatUsd, shortenAddress } from "./shared/format";
import type { EnrichedTrade } from "./types";

const logger = createLogger("telegram");

/**
 * All Telegram-specific concerns (bot instance, message formatting,
 * sending) live in this file and commands.ts only. Neither imports
 * ethers, the SQLite driver, or anything chain-facing directly — they
 * receive already-computed plain data from stats.ts / the listener
 * pipeline. This keeps blockchain logic and Telegram logic isolated, so
 * either side (e.g. swapping Telegraf for another library, or adding a
 * Discord adapter later) can change independently.
 */
export function createBot(): Telegraf {
  return new Telegraf(config.telegram.botToken);
}

export function explorerTxUrl(txHash: string): string {
  return `${config.chain.explorerBaseUrl}/tx/${txHash}`;
}

export function formatTradeMessage(trade: EnrichedTrade): string {
  const isBuy = trade.direction === "buy";
  const headline = isBuy ? "🟢 <b>NEW BUY</b> — $HANSOME" : "🔴 <b>NEW SELL</b> — $HANSOME";
  const actorLabel = isBuy ? "👤 Buyer" : "👤 Seller";
  const ethLabel = isBuy ? "💰 ETH Spent" : "💰 ETH Received";
  const tokenLabel = isBuy ? "🦙 HANSOME Received" : "🦙 HANSOME Sold";
  const holderSuffix = isBuy && trade.isNewHolder ? " (🆕 new holder!)" : "";
  const holdersValue = trade.totalHolders !== null ? formatTokenAmount(trade.totalHolders) : "—";
  const liquidityValue = trade.liquidityUsd !== null ? formatUsd(trade.liquidityUsd) : "—";

  const lines = [
    headline,
    "",
    `${ethLabel}: ${formatEth(trade.ethAmount)}`,
    `${tokenLabel}: ${formatTokenAmount(trade.hansomeAmount, "HANSOME")}`,
    `💵 USD Value: ${formatUsd(trade.usdValue)}`,
    `📊 Current Price: ${formatUsd(trade.priceUsd)} (${formatEth(trade.priceEth)})`,
    `📈 Market Cap: ${formatUsd(trade.marketCapUsd)}`,
    `💧 Liquidity: ${liquidityValue}`,
    `👥 Holders: ${holdersValue}${holderSuffix}`,
    `${actorLabel}: <code>${shortenAddress(trade.traderAddress)}</code>`,
    "",
    `🔗 <a href="${explorerTxUrl(trade.txHash)}">Transaction</a> · <a href="${config.links.dexScreenerUrl}">DexScreener</a> · <a href="${config.links.websiteUrl}">Website</a>`,
  ];

  return lines.join("\n");
}

/**
 * Extracts everything useful from a Telegraf TelegramError (which wraps
 * Telegram's raw API error body — error_code, description, and
 * sometimes `parameters`, e.g. `migrate_to_chat_id` when a group has been
 * upgraded to a supergroup) without assuming its shape. Never swallow
 * this into a generic "failed" log — the exact `description` is almost
 * always the actionable part (e.g. "Bad Request: message thread not
 * found", "Forbidden: bot was kicked from the group chat").
 */
function describeTelegramError(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object") {
    const err = error as { response?: unknown; message?: string; code?: unknown; on?: unknown };
    return {
      message: err.message,
      code: err.code,
      response: err.response, // Telegram's raw { ok:false, error_code, description, parameters } body, if present
      on: err.on, // Telegraf's { method, payload } that was being sent, if present
    };
  }
  return { raw: String(error) };
}

/**
 * Sends a trade notification and logs the COMPLETE Telegram API result —
 * either the full raw `Message` object Telegram returned (proving exactly
 * which chat.id and, for forum supergroups, which message_thread_id it
 * landed in), or the complete error body if the call failed. Never just
 * logs "sent" without evidence — a 200 OK with `ok:true` can still land
 * in the wrong topic if message_thread_id isn't set for a forum chat.
 */
export async function sendTradeNotification(bot: Telegraf, trade: EnrichedTrade): Promise<void> {
  const text = formatTradeMessage(trade);
  const extra: Parameters<typeof bot.telegram.sendMessage>[2] = {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(config.telegram.messageThreadId !== null ? { message_thread_id: config.telegram.messageThreadId } : {}),
  };

  try {
    const result = await bot.telegram.sendMessage(config.telegram.chatId, text, extra);
    logger.info(
      `Telegram sendMessage OK for ${trade.direction} tx=${trade.txHash} — message_id=${result.message_id} chat.id=${result.chat.id} chat.title=${"title" in result.chat ? result.chat.title : "(n/a)"} message_thread_id=${
        "message_thread_id" in result ? result.message_thread_id : "(none — landed in General topic if this is a forum)"
      } requestedThreadId=${config.telegram.messageThreadId ?? "(none set)"}`,
    );
  } catch (error) {
    logger.error(
      `Telegram sendMessage FAILED for ${trade.direction} tx=${trade.txHash} — chatId=${config.telegram.chatId} requestedThreadId=${config.telegram.messageThreadId ?? "(none set)"}. Full error: ${JSON.stringify(describeTelegramError(error))}`,
      error,
    );
  }
}

export async function sendPlainMessage(bot: Telegraf, chatId: string | number, text: string): Promise<void> {
  await bot.telegram.sendMessage(chatId, text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}
