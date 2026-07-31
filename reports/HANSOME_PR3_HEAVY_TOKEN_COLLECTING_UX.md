# HANSOME — PR3 Heavy-Token Collecting UX

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | UX copy + progress display only |
| **Verdict** | **PASS** |
| **Deploy** | **NO** |

Depends on: PR1 PASS · PR2 PASS

---

## Summary

| Requirement | Result |
|-------------|--------|
| Keep estimates initially | **PASS** |
| Over estimate → replace with heavy-history EN/ZH | **PASS** — exact product strings |
| Show pages / transfers / retry when available | **PASS** — progress panel + Burn/Creator |
| No infinite Collecting; exhausted → unavailable | **PASS** — existing `isDeepCollecting` / retry budget |
| Manual Refresh recovery | **PASS** — unchanged Refresh control |
| EN/ZH + mobile-friendly layout | **PASS** — shared compact text stack |

---

## Copy (exact)

| Locale | String |
|--------|--------|
| EN | Still analyzing — this token has more on-chain history than usual. |
| ZH | 仍在分析中 — 此代幣的鏈上歷史較多，因此需要更多時間。 |

---

## Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/heavy-token-ux.ts` | **New** — ETA exceed / retry / progress helpers |
| `components/scan/ScanClient.tsx` | Replace ETA when exceeded; show progress + retry |
| `content/i18n/en.ts` / `zh.ts` / `types.ts` | Exact copy + progress/retry strings |
| `lib/hansome-score/__tests__/heavy-token-ux.test.ts` | **New** |

---

## Heavy-token UX timeline

| Phase | UI |
|-------|-----|
| Under soft estimate | Short ETA (e.g. ~1–2 min Burn/Creator) |
| Over soft estimate | ETA **replaced** by heavy-history sentence |
| Checkpoint progress available | “So far: N pages · M transfers indexed” |
| Auto-retry in flight | “Attempt k of max” |
| Retries exhausted | Terminal unavailable (not infinite Collecting) |
| User recovery | Manual Refresh |

Soft ceilings (UX only — budgets unchanged): relationships 15s · creator/burn 120s · liquidity 240s.

---

## Tests

```
vitest run heavy-token-ux (+ PR1/PR2 / deep / LP / burn suites)
→ passed
tsc --noEmit → clean
next build → compile + types OK; full prerender succeeded on clean rebuild
```

---

## Freeze confirmation

- [x] UX only — no Score / Burn / lock semantics
- [x] No timeout inflation
- [x] **NO deploy**

---

## Gate

**PR3 = PASS.**
