import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;

const BG = "#BFE8F6";
const GOLD = "#96591A";
const TEXT = "#3B2A18";
const MUTED = "#6B5A44";

function coinDataUrl() {
  const buffer = readFileSync(join(process.cwd(), "public/logo/logo-256.png"));
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export function createOgImageResponse() {
  const coin = coinDataUrl();
  const coinSize = 440;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: BG,
          padding: "48px 120px 56px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              width: coinSize,
              height: coinSize,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                position: "absolute",
                width: coinSize * 1.55,
                height: coinSize * 1.55,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(242,179,61,0.35) 0%, rgba(242,179,61,0.16) 38%, rgba(242,179,61,0.05) 58%, transparent 72%)",
              }}
            />
            <img src={coin} width={coinSize} height={coinSize} alt="" />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 58,
                fontWeight: 900,
                letterSpacing: "0.06em",
                color: TEXT,
                lineHeight: 1,
              }}
            >
              HANSOME ALPACAS
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 30,
                color: MUTED,
                lineHeight: 1.2,
                letterSpacing: "0.02em",
              }}
            >
              Too handsome to be useful.
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 22,
                color: GOLD,
                lineHeight: 1.3,
                letterSpacing: "0.01em",
              }}
            >
              Preparing for launch on Robinhood Chain.
            </div>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

export function createCoinIconResponse(size: number) {
  const coin = coinDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: BG,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img src={coin} width={size - 4} height={size - 4} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
