# UGLY DEER Go / No-Go

Final readiness checklist **before creating the token**.

**Planning only.** This document does not mint, deploy, or spend funds. A human signs off at the bottom when every required item is verified.

**Status options:** `[ ]` not ready · `[x]` ready · `[~]` in progress · `[?�]` not applicable yet

---

## 1. Product

| Item | Status | Notes |
| ---- | ------ | ----- |
| [x] Website live | | https://kairu.lol deployed on Vercel |
| [x] Bilingual (zh / en) | | Language toggle, i18n content |
| [x] Analytics | | GA4 configured; event queue fix deployed |
| [x] Music | | Ambient track; interaction unlock |
| [x] Community | | Deer Trail Community ??@DeerloveRu |
| [x] Claim copy | | Follow + share + manual claim + token about on site |
| [ ] Deer Vote tested on mobile | | |
| [ ] Contract section ready for CA | | Env vars documented; awaiting `NEXT_PUBLIC_CONTRACT` |
| [ ] Claim submission UI | | Future ??not required for token *creation* gate |

---

## 2. Branding

| Item | Status | Notes |
| ---- | ------ | ----- |
| [x] Logo | | `public/logo/coin.svg`, `logo-256.png`, `logo-512.png` (upscale) |
| [x] Mascot | | Hero + identity SVGs (`public/identities/`) |
| [~] Metadata | | Draft `metadata/token.json` ??not uploaded on-chain |
| [x] Whitepaper | | `launch/WHITEPAPER.md` (planning draft) |
| [ ] FAQ reviewed | | `launch/FAQ.md` |
| [ ] DO_NOTS reviewed | | `launch/DO_NOTS.md` |
| [ ] Announcement drafts approved | | `launch/ANNOUNCEMENT.md` ??replace TBA before post |
| [ ] OG / X banner aligned | | `public/images/` |

---

## 3. Community

| Item | Status | Notes |
| ---- | ------ | ----- |
| [x] X account ready | | https://x.com/DeerloveRu linked on site |
| [ ] Follower baseline recorded | | Record count at go/no-go date: ________ |
| [ ] Deer shares observed | | Organic shares from Deer Vote ??informal OK |
| [~] Analytics healthy | | GA4 DebugView / reports reviewed |
| [ ] Pinned tweet ready | | See `launch/ANNOUNCEMENT.md` |
| [ ] Telegram (if used) | | `NEXT_PUBLIC_TELEGRAM` ??optional |
| [ ] Scam / impersonation check | | No fake contracts promoted |

---

## 4. Blockchain

**Do not create mint until Sections 1?? are signed off.**

| Item | Status | Notes |
| ---- | ------ | ----- |
| [ ] Phantom wallet ready | | Launch wallet created; seed phrase secured offline |
| [ ] Enough SOL | | Balance for mint + metadata + initial tx fees: ________ SOL |
| [ ] Token metadata prepared | | `metadata/token.json` finalized; image URI live |
| [ ] Metadata URI hosted | | IPFS / Arweave / permanent URL decided ??**not uploaded yet** |
| [x] Mint not created | | **Must remain unchecked until GO decision** |
| [ ] Tokenomics finalized | | `launch/TOKENOMICS.md` no longer placeholder |
| [ ] Claim rules published | | `launch/CLAIM.md` finalized publicly |
| [ ] Contract address backup plan | | Secure storage for mint key + metadata URI |

---

## 5. Launch decision

Review immediately before mint:

| Question | YES | NO |
| -------- | --- | -- |
| All **Product** blockers cleared? | [ ] | [ ] |
| All **Branding** assets approved? | [ ] | [ ] |
| **Community** channels ready for announcement? | [ ] | [ ] |
| **Blockchain** prep complete (wallet, SOL, metadata ??still no mint)? | [ ] | [ ] |
| `DO_NOTS.md` understood by anyone posting on X? | [ ] | [ ] |
| `ANNOUNCEMENT.md` TBA fields filled (after mint only)? | [ ] | [ ] |
| Vercel env var plan ready for post-mint redeploy? | [ ] | [ ] |
| No guaranteed profit / listing language in any copy? | [ ] | [ ] |

**Blockers (any = NO-GO):**

- Mint created before this document is signed YES
- Unverified contract address circulating
- Metadata JSON not matching live logo URL
- Insufficient SOL for planned transactions
- Claim rules not published if manual claim is promised

---

## Sign-off

| Field | Value |
| ----- | ----- |
| Date | __________________ |
| Reviewer | __________________ |
| Build / commit verified | __________________ |

---

## READY TO LAUNCH

Select **one**:

- [ ] **YES** ??All sections complete. Authorized to proceed to token **creation** (separate step; still follow `CHECKLIST.md` Phase 3).
- [ ] **NO** ??Do not create mint. Document blockers below.

**Blockers (if NO):**

```
1.
2.
3.
```

---

## After YES (reminder ??not part of this repo)

1. Create mint on Solana (outside this checklist)
2. Update `metadata/token.json` ??`_planning.mint_address`
3. Set Vercel env: `NEXT_PUBLIC_CONTRACT`, `NEXT_PUBLIC_BUY`, `NEXT_PUBLIC_CHART`
4. Redeploy website
5. Publish `launch/ANNOUNCEMENT.md` copy
6. Update `launch/CHECKLIST.md` status

---

© 2026 UGLY DEER
