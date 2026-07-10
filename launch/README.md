# KAIRU Launch

Planning documents for the KAIRU token launch on Solana.

**This folder is for planning only.** It does not deploy contracts, mint tokens, or move funds.

## Documents

| File | Purpose |
| ---- | ------- |
| [TOKEN.md](./TOKEN.md) | Token identity and chain parameters |
| [TOKENOMICS.md](./TOKENOMICS.md) | Placeholder allocation model (TBD before launch) |
| [CLAIM.md](./CLAIM.md) | Manual claim flow and eligibility rules |
| [CHECKLIST.md](./CHECKLIST.md) | Pre-launch and launch-day checklist |
| [WHITEPAPER.md](./WHITEPAPER.md) | Short project overview (planning draft) |
| [FAQ.md](./FAQ.md) | Common questions |
| [ANNOUNCEMENT.md](./ANNOUNCEMENT.md) | Launch announcement drafts (EN / zh) |
| [DO_NOTS.md](./DO_NOTS.md) | Intentional non-promises |
| [GO_NO_GO.md](./GO_NO_GO.md) | Final readiness gate before token creation |
| [metadata/](./metadata/) | Token metadata structure (not deployed) |

## Related folders

| Folder | Purpose |
| ------ | ------- |
| [assets/](./assets/) | Launch screenshots and exports |
| [memes/](./memes/) | Community meme assets |
| [twitter/](./twitter/) | X post drafts |
| [telegram/](./telegram/) | Telegram announcement drafts |
| [press/](./press/) | Press and announcement copy |

## Current decisions

| Field | Value |
| ----- | ----- |
| Chain | Solana |
| Name | KAIRU |
| Symbol | KAIRU |
| Supply | 1,000,000,000 |
| Decimals | 9 |
| Website | https://kairu.lol |
| X | [@DeerloveRu](https://x.com/DeerloveRu) |
| Contract | Not deployed |
| Claim | Manual verification (no on-chain claim yet) |

## Site integration

Environment variables are documented in `.env.example`. When the contract is live, set `NEXT_PUBLIC_CONTRACT`, `NEXT_PUBLIC_BUY`, and `NEXT_PUBLIC_CHART` in Vercel and redeploy.

## Disclaimer

KAIRU is a meme. Not financial advice. Nothing in this folder promises returns, guaranteed rewards, or specific utility.

---

© 2026 KAIRU
