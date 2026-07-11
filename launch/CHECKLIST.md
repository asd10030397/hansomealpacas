# UGLY DEER Launch Checklist

Master checklist for launch planning. Update status as work progresses.

**Status options:** `NOT STARTED` · `IN PROGRESS` · `COMPLETE`

---

## Phase 1 — Brand

- [x] Final mascot approved
- [x] SVG exported (`public/logo/logo.svg`)
- [x] PNG exports complete
- [x] Favicon complete
- [ ] X avatar aligned with brand
- [ ] X banner complete
- [x] Website deployed (https://kairu.lol)
- [x] Bilingual site (zh / en)
- [x] Deer Vote live
- [x] Ambient soundtrack
- [x] Analytics (GA4) configured

---

## Phase 2 — Community

- [x] Official X linked on site (@UglyDeerSol)
- [x] Deer Trail Community row → https://x.com/UglyDeerSol
- [ ] Telegram ready (`NEXT_PUBLIC_TELEGRAM`)
- [ ] First 10 tweets prepared (`launch/twitter/`)
- [ ] Pinned tweet ready
- [ ] Announcement image ready
- [ ] Community finds UGLY DEER organically

---

## Phase 3 — Token (planning only — do not mint until ready)

- [ ] Tokenomics finalized (`TOKENOMICS.md`)
- [ ] Token created on Solana
- [ ] Symbol verified (UGLY)
- [ ] Supply: 1,000,000,000 · Decimals: 9
- [ ] Contract address saved
- [ ] Mint / freeze authority plan documented
- [ ] Liquidity plan documented
- [ ] Website env updated (`NEXT_PUBLIC_CONTRACT`, `NEXT_PUBLIC_BUY`, `NEXT_PUBLIC_CHART`)
- [ ] Copy button enabled on site
- [ ] Claim rules published (`CLAIM.md` finalized)

---

## Phase 4 — Launch day

- [ ] Publish contract address on X
- [ ] Publish first announcement
- [ ] Publish chart link
- [ ] Publish buy link
- [ ] Redeploy Vercel with live env vars
- [ ] Telegram announcement
- [ ] Verify production site (contract section, links, analytics)
- [ ] Save screenshots to `launch/assets/`

---

## Phase 5 — Manual claim (post-launch)

- [ ] Claim submission method live
- [ ] Internal verification SOP in use
- [ ] Wallet connect (if implemented) tested
- [ ] First allocations sent to verified deer
- [ ] Claim window communicated publicly

---

## Phase 6 — Post launch

- [ ] Daily presence on X
- [ ] Memes (`launch/memes/`, `public/memes/`)
- [ ] Reply to community when necessary
- [ ] Update website as Deer Trail progresses
- [ ] The Herd Grows — future experiences (TBD)

---

## Deer Trail progress

| Item | Status |
| ---- | ------ |
| Website | COMPLETE |
| Community | COMPLETE |
| Deer Identity | COMPLETE |
| Token Launch | NOT STARTED |
| Wallet Connect | NOT STARTED |
| Claim UGLY | NOT STARTED |
| The Herd Grows | NOT STARTED |

---

## Launch status summary

| Area | Status |
| ---- | ------ |
| Brand | IN PROGRESS |
| Community | IN PROGRESS |
| Website | COMPLETE |
| Token | NOT STARTED |
| Launch | NOT STARTED |
| Manual claim | NOT STARTED |

---

## Environment variables (launch day)

```env
NEXT_PUBLIC_WEBSITE=https://kairu.lol
NEXT_PUBLIC_X=https://x.com/UglyDeerSol
NEXT_PUBLIC_TELEGRAM=
NEXT_PUBLIC_CONTRACT=
NEXT_PUBLIC_BUY=
NEXT_PUBLIC_CHART=
NEXT_PUBLIC_GA_ID=
```

See `.env.example` for the full list.

---

© 2026 UGLY DEER
