# HANSOME Phase 13F — Release Candidate

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13F — Release Candidate |
| **Final verdict** | **NOT PRODUCED — STOPPED_WITH_RCA** |
| **Reason** | Phase 13E product certification failed (HANSOME cold 3/5; GME 0/15; OKC incomplete) |
| **BEER gate** | **PASS** on Candidate `dpl_qXzBSFonvfLidTysYuiRopWALgYR` (does not alone open RC) |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted www / apex / game?** | **NO** |
| **Alias cutover** | **STOPPED before cutover** |

## Gate checklist (blocked)

| Step | Status |
|------|--------|
| Clean worktree | N/A (13E fail; worktree dirty with 13E fixes) |
| Typecheck | PASS on worktree prior to stop |
| Full scoring tests | Not packaged as RC |
| Production build | Candidate deploys built OK |
| Release notes / rollback docs | Not authored for RC |
| Production-target RC deployment | Candidates only (`dpl_qXz…`) |
| Promotion guard | N/A — no promote |
| Alias cutover | **HOLD** |

## Promotion decision

**HOLD / STOP before cutover**

Do not promote. Resume after 13E full matrix PASS (+ 13E.1 stress), then produce RC and still STOP before alias cutover.
