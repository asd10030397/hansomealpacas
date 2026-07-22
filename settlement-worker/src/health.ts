import http from "node:http";
import { log } from "./logger.js";

export type HealthStatus = {
  ok: boolean;
  worker: string;
  profile: string;
  chainId: number;
  dryRun: boolean;
  startedAt: string;
  lastTickAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  currentDay: number | null;
  settler: string | null;
  seedWallet: string | null;
};

export function createHealthServer(
  host: string,
  port: number,
  getStatus: () => HealthStatus,
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" || req.url === "/health" || req.url === "/") {
      const status = getStatus();
      const code = status.ok ? 200 : 503;
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(status));
      return;
    }
    if (req.url === "/readyz") {
      const status = getStatus();
      const ready = status.ok && status.lastTickAt != null;
      res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ready, ...status }));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });

  server.listen(port, host, () => {
    log.info("health_listen", { host, port });
  });

  return server;
}
