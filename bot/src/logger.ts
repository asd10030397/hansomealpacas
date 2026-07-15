/**
 * Minimal structured logger. No external deps — a full logging library
 * would be overkill for a single-process bot, but the small level/format
 * wrapper keeps output consistent and easy to grep in PM2/systemd logs.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.LOG_LEVEL?.trim().toLowerCase() as Level) || "info";
const threshold = LEVEL_WEIGHT[configuredLevel] ?? LEVEL_WEIGHT.info;

function write(level: Level, scope: string, message: string, meta?: unknown): void {
  if (LEVEL_WEIGHT[level] < threshold) return;

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] [${scope}] ${message}`;

  const target = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (meta !== undefined) {
    target(line, meta);
  } else {
    target(line);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) => write("debug", scope, message, meta),
    info: (message: string, meta?: unknown) => write("info", scope, message, meta),
    warn: (message: string, meta?: unknown) => write("warn", scope, message, meta),
    error: (message: string, meta?: unknown) => write("error", scope, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
