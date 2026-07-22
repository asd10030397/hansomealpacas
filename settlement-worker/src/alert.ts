import { log } from "./logger.js";

export async function sendAlert(
  webhookUrl: string | null,
  payload: {
    severity: "info" | "warn" | "error";
    title: string;
    detail?: string;
    fields?: Record<string, unknown>;
  },
): Promise<void> {
  log[payload.severity === "error" ? "error" : payload.severity]("alert", {
    title: payload.title,
    detail: payload.detail,
    ...payload.fields,
  });

  if (!webhookUrl) return;

  try {
    const text = [
      `[${payload.severity.toUpperCase()}] ${payload.title}`,
      payload.detail || "",
      payload.fields ? JSON.stringify(payload.fields) : "",
    ]
      .filter(Boolean)
      .join("\n");

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        content: text,
        ...payload,
      }),
    });
  } catch (e) {
    log.warn("alert_webhook_failed", { error: String(e) });
  }
}
