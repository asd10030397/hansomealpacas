# Android App Download UI — Verification Report

| Field | Value |
|-------|-------|
| Date | 2026-07-23 |
| Scope | Marketing homepage CTA + `/download` page + public APK assets |

## Verdicts

| Check | Result |
|-------|--------|
| **DOWNLOAD BUTTON** | **PASS** |
| **APK PUBLIC URL** | `https://game.hansomealpacas.xyz/downloads/hansome-android.apk` |
| **SHA-256 MATCH** | **YES** |
| **SAFE TO DEPLOY** | **YES** |

## APK verification

| Item | Value |
|------|-------|
| Source artifact | `artifacts/hansome-game-debug.apk` |
| Expected SHA-256 | `41743b01c873f0388e0c96cadf26eb5a7ce65242759d96d221c85ef85b7e8c9b` |
| Stable public file | `public/downloads/hansome-android.apk` |
| Versioned public file | `public/downloads/hansome-android-2026-07-23.apk` |
| Stable public SHA-256 | `41743b01c873f0388e0c96cadf26eb5a7ce65242759d96d221c85ef85b7e8c9b` |
| Versioned public SHA-256 | `41743b01c873f0388e0c96cadf26eb5a7ce65242759d96d221c85ef85b7e8c9b` |
| File size | 4,426,622 bytes (4.22 MB) |
| Build date | 2026-07-23 |

## UI changes

### Marketing homepage (`sections/HeroSection.tsx`)

- Added **Play Game** CTA → `https://game.hansomealpacas.xyz/`
- Added **Download Android App** CTA → `/download` with subtext `Android APK · Direct Download` / `Android APK · 直接下载`
- Install note shown below CTAs (no Google Play claim)

### Download page (`app/download/page.tsx`)

- Title, build date, file size, SHA-256, download button
- Install steps + direct APK / sideload note
- Stable + versioned download links documented

## i18n

Added keys under `hero.*` and `download.*` in:

- `content/i18n/en.ts`
- `content/i18n/zh.ts`
- `content/i18n/types.ts`

## Cache headers

`next.config.ts` — `/downloads/:path*.apk`:

- `Cache-Control: public, max-age=300, must-revalidate`
- `Content-Type: application/vnd.android.package-archive`

Middleware already bypasses rewrites for paths containing `.` (APK static files serve on both marketing and game hosts).

## Build verification

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (pre-existing warnings only) |
| `npm run build` | PASS (`/download` static route generated) |

## Scope safety

Files changed/added for this task only:

- `app/download/page.tsx`
- `components/download/DownloadPageContent.tsx`
- `lib/androidDownload.ts`
- `sections/HeroSection.tsx`
- `content/i18n/en.ts`
- `content/i18n/zh.ts`
- `content/i18n/types.ts`
- `next.config.ts`
- `public/downloads/hansome-android.apk`
- `public/downloads/hansome-android-2026-07-23.apk`

**No mint / reveal / genesis / contract / wallet business logic / mainnet config files were modified by this task.**

## Deployment notes

- Not deployed in this session (per instructions).
- Not committed in this session (per instructions).
- After deploy, confirm live SHA at the public URL matches the value above.
