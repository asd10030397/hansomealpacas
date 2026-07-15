import type { Telegraf } from "telegraf";
import { config } from "./config";
import { createLogger } from "./logger";
import { formatEth, formatTokenAmount, formatUsd } from "./shared/format";
import type { StatsService } from "./stats";
import type { StatusSnapshot } from "./types";

const logger = createLogger("commands");

function formatTimestamp(unixSeconds: number | null): string {
  if (!unixSeconds) return "Never";
  return new Date(unixSeconds * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function buildStatusBlock(snapshot: StatusSnapshot, title: string): string {
  const { state } = snapshot;
  return [
    `<b>${title}</b>`,
    "",
    `🪙 Token: $HANSOME`,
    `📄 Contract: <code>${config.chain.tokenAddress}</code>`,
    `💵 Current Price: ${formatUsd(snapshot.priceUsd)} (${formatEth(snapshot.priceEth)})`,
    `📈 Market Cap: ${formatUsd(snapshot.marketCapUsd)}`,
    `💧 Liquidity: ${snapshot.liquidityUsd !== null ? formatUsd(snapshot.liquidityUsd) : "—"}`,
    `👥 Total Holders: ${snapshot.totalHolders !== null ? formatTokenAmount(snapshot.totalHolders) : "—"}`,
    "",
    `🟢 Total Buys: ${formatTokenAmount(state.totalBuys)}`,
    `🔴 Total Sells: ${formatTokenAmount(state.totalSells)}`,
    `📊 24H Volume: ${formatEth(snapshot.volume24hEth)} (${formatTokenAmount(snapshot.buys24h)} buys / ${formatTokenAmount(snapshot.sells24h)} sells)`,
    `🏆 Largest Buy (24h): ${formatEth(snapshot.largestBuy24hEth)}`,
    `🏆 Largest Sell (24h): ${formatEth(snapshot.largestSell24hEth)}`,
    `🕐 Last Buy: ${formatTimestamp(state.lastBuyAt)}`,
    `🕐 Last Sell: ${formatTimestamp(state.lastSellAt)}`,
  ].join("\n");
}

/**
 * Registers all Telegram commands. Only talks to StatsService (plain data)
 * — no direct chain or database access here, keeping Telegram concerns
 * isolated from blockchain concerns per the project's architecture.
 */
export function registerCommands(bot: Telegraf, stats: StatsService): void {
  bot.command("start", async (ctx) => {
    await ctx.replyWithHTML(
      [
        "👋 <b>Welcome to the HANSOME ALPACAS Buy Bot</b>",
        "",
        "I watch the official $HANSOME/ETH Uniswap v4 pool on Robinhood Chain and post live buy/sell alerts right here.",
        "",
        "Try /help to see everything I can do.",
        "",
        `🌐 <a href="${config.links.websiteUrl}">Website</a> · <a href="${config.links.dexScreenerUrl}">DexScreener</a>`,
      ].join("\n"),
      { link_preview_options: { is_disabled: true } },
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.replyWithHTML(
      [
        "<b>Commands</b>",
        "",
        "/status — full token + bot status",
        "/stats — all-time and 24h trading stats",
        "/price — current price only",
        "/liquidity — pool liquidity",
        "/help — this message",
      ].join("\n"),
    );
  });

  bot.command("status", async (ctx) => {
    try {
      const snapshot = await stats.getStatusSnapshot();
      const uptimeMinutes = Math.floor(process.uptime() / 60);
      const body = buildStatusBlock(snapshot, "📊 HANSOME Status");
      await ctx.replyWithHTML(`${body}\n\n✅ Bot Status: online (up ${uptimeMinutes}m)`, {
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      logger.error("Failed to build /status response", error);
      await ctx.reply("⚠️ Couldn't load status right now — please try again shortly.");
    }
  });

  bot.command("stats", async (ctx) => {
    try {
      const snapshot = await stats.getStatusSnapshot();
      await ctx.replyWithHTML(buildStatusBlock(snapshot, "📈 HANSOME Stats"), {
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      logger.error("Failed to build /stats response", error);
      await ctx.reply("⚠️ Couldn't load stats right now — please try again shortly.");
    }
  });

  bot.command("price", async (ctx) => {
    try {
      const snapshot = await stats.getStatusSnapshot();
      await ctx.replyWithHTML(
        [
          "<b>💵 HANSOME Price</b>",
          "",
          `Price: ${formatUsd(snapshot.priceUsd)} (${formatEth(snapshot.priceEth)})`,
          `Market Cap: ${formatUsd(snapshot.marketCapUsd)}`,
        ].join("\n"),
      );
    } catch (error) {
      logger.error("Failed to build /price response", error);
      await ctx.reply("⚠️ Couldn't load price right now — please try again shortly.");
    }
  });

  bot.command("liquidity", async (ctx) => {
    try {
      const snapshot = await stats.getStatusSnapshot();
      await ctx.replyWithHTML(
        [
          "<b>💧 HANSOME Liquidity</b>",
          "",
          `Pool Liquidity: ${snapshot.liquidityUsd !== null ? formatUsd(snapshot.liquidityUsd) : "unavailable right now"}`,
          `Pair: ETH / HANSOME (Uniswap v4, 0.05% fee)`,
          "",
          "See the Transparency page on the website for official LP lock details.",
          `🌐 <a href="${config.links.websiteUrl}/transparency">${config.links.websiteUrl}/transparency</a>`,
        ].join("\n"),
        { link_preview_options: { is_disabled: true } },
      );
    } catch (error) {
      logger.error("Failed to build /liquidity response", error);
      await ctx.reply("⚠️ Couldn't load liquidity right now — please try again shortly.");
    }
  });
}
