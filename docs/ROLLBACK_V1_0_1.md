# HANSOME Scan — Rollback (v1.0.1 attempt)

| Field | Value |
|-------|--------|
| **Authority** | Custom domain aliases only (`www` / apex / `game`) |
| **Known-good tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Known-good URL** | `https://hansomealpacas-hp5h51664-the-67.vercel.app` |
| **Phase 13B cutover** | **Did not occur** (`RELEASE_ABORTED`) |
| **Phase 13B.1 cutover** | **Did not occur** (`RELEASE_ABORTED`) |

Isolation / promotion rules: [`docs/DEPLOYMENT_ISOLATION.md`](DEPLOYMENT_ISOLATION.md).  
Generic rollback: [`docs/ROLLBACK.md`](ROLLBACK.md).

---

## When to use

If a future `v1.0.1` promote is performed and any of the following appear:

- Orphaned analyzing on production aliases  
- Candidate/Production scope collision  
- False Locked / false lock%  
- Titan / BEER Pons / Score regressions  
- Alias mismatch / runtime errors / cache corruption / Hook UI conflict  

---

## Procedure

```bash
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app www.hansomealpacas.xyz
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app hansomealpacas.xyz
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app game.hansomealpacas.xyz
```

Verify:

```bash
npx vercel inspect www.hansomealpacas.xyz
npx vercel inspect hansomealpacas.xyz
npx vercel inspect game.hansomealpacas.xyz
```

Expect deployment id **`dpl_995JvbHVDTsv4mSP77rJqeas8GEA`** on all three.

---

## Phase 13B / 13B.1 status

Rollback was **not executed** because aliases were never moved. Live tip remains `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`.
