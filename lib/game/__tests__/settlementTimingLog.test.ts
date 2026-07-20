import { afterEach, describe, expect, it, vi } from "vitest";
import { SettlementTimingTrace } from "@/lib/game/server/settlementTimingLog";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettlementTimingTrace", () => {
  it("redacts private-key-shaped hex in detail", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const t = new SettlementTimingTrace(7, "test-req");
    t.log("tx_error", {
      detail:
        "boom 0x1111111111111111111111111111111111111111111111111111111111111111",
    });
    const last = t.getEvents().at(-1);
    expect(last?.detail).toContain("0x[redacted]");
    expect(last?.detail).not.toContain(
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    );
  });

  it("records battle_ready before fully_settled", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const t = new SettlementTimingTrace(3, "test-req2");
    t.markBattleReady();
    t.markFullySettled();
    const events = t.getEvents().map((e) => e.event);
    expect(events.indexOf("battle_ready")).toBeLessThan(
      events.indexOf("fully_settled"),
    );
  });
});
