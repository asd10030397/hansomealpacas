import { readFileSync } from "node:fs";
import sharp from "sharp";

export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;
export const COIN_WIDTH_RATIO = 0.46;

const BG = "#0D0D0D";

/** Deterministic gold dust — stable across OG and Twitter exports */
const PARTICLES = [
  [118, 86, 2.4, 0.34],
  [1042, 118, 1.8, 0.28],
  [892, 54, 1.5, 0.22],
  [286, 118, 1.6, 0.24],
  [968, 392, 2.1, 0.26],
  [154, 348, 1.4, 0.2],
  [742, 68, 2.2, 0.3],
  [512, 598, 1.3, 0.18],
  [1088, 268, 1.7, 0.21],
  [64, 228, 1.9, 0.19],
  [628, 44, 1.2, 0.16],
  [378, 512, 1.6, 0.17],
];

function particleMarkup() {
  return PARTICLES.map(
    ([x, y, r, o]) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#D4AF37" fill-opacity="${o}"/>`,
  ).join("\n  ");
}

function backgroundSvg(width, height, coinCx, coinCy, coinSize) {
  const glowR = coinSize * 0.92;
  const haloR = coinSize * 0.58;

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="coinGlow" cx="${coinCx}" cy="${coinCy}" r="${glowR}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F0D060" stop-opacity="0.28"/>
      <stop offset="28%" stop-color="#D4AF37" stop-opacity="0.16"/>
      <stop offset="52%" stop-color="#8B6914" stop-opacity="0.06"/>
      <stop offset="72%" stop-color="#0D0D0D" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="coinHalo" cx="${coinCx}" cy="${coinCy}" r="${haloR}" gradientUnits="userSpaceOnUse">
      <stop offset="58%" stop-color="#D4AF37" stop-opacity="0"/>
      <stop offset="82%" stop-color="#D4AF37" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="46%" r="78%">
      <stop offset="52%" stop-color="#0D0D0D" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.58"/>
    </radialGradient>
    <linearGradient id="textFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0D0D0D" stop-opacity="0"/>
      <stop offset="38%" stop-color="#0D0D0D" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#0D0D0D" stop-opacity="0.96"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${BG}"/>
  <circle cx="${coinCx}" cy="${coinCy}" r="${glowR}" fill="url(#coinGlow)"/>
  <circle cx="${coinCx}" cy="${coinCy}" r="${haloR}" fill="url(#coinHalo)"/>
  ${particleMarkup()}
  <rect width="100%" height="100%" fill="url(#vignette)"/>
  <rect x="0" y="${Math.round(height * 0.62)}" width="${width}" height="${Math.round(height * 0.38)}" fill="url(#textFade)"/>
</svg>`);
}

function typographySvg(width, height) {
  const cx = width / 2;
  const taglineY = height - 32;
  const subtitleY = height - 68;
  const titleY = height - 104;
  const ruleY = titleY + 16;

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="titleFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E4E4E4"/>
    </linearGradient>
    <filter id="titleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <text x="${cx}" y="${titleY}" text-anchor="middle" font-family="Impact, Haettenschweiler, Arial Black, sans-serif" font-size="50" font-weight="900" fill="url(#titleFill)" letter-spacing="8" filter="url(#titleGlow)">HANSOME ALPACAS</text>
  <line x1="${cx - 88}" y1="${ruleY}" x2="${cx + 88}" y2="${ruleY}" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.45"/>
  <text x="${cx}" y="${subtitleY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" fill="#B8B8B8" letter-spacing="1.5">Too handsome to be useful.</text>
  <text x="${cx}" y="${taglineY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#D4AF37" letter-spacing="0.8">Preparing for launch on Robinhood Chain.</text>
</svg>`);
}

function coinHighlightSvg(coinSize) {
  const cx = coinSize / 2;

  return Buffer.from(`<svg width="${coinSize}" height="${coinSize}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="specular" cx="34%" cy="26%" r="42%">
      <stop offset="0%" stop-color="#FFF8E7" stop-opacity="0.62"/>
      <stop offset="38%" stop-color="#FFE08A" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rimLight" x1="8%" y1="8%" x2="92%" y2="92%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="42%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>
    </linearGradient>
  </defs>
  <ellipse cx="${coinSize * 0.34}" cy="${coinSize * 0.26}" rx="${coinSize * 0.36}" ry="${coinSize * 0.3}" fill="url(#specular)"/>
  <circle cx="${cx}" cy="${cx}" r="${cx - 3}" fill="none" stroke="url(#rimLight)" stroke-width="3"/>
  <path d="M ${coinSize * 0.18} ${coinSize * 0.42} Q ${coinSize * 0.34} ${coinSize * 0.28} ${coinSize * 0.52} ${coinSize * 0.36}" fill="none" stroke="#FFF8D0" stroke-width="2" stroke-opacity="0.16"/>
</svg>`);
}

async function renderPremiumCoin(coinSvgPath, coinSize) {
  const supersample = coinSize * 2;
  const base = await sharp(readFileSync(coinSvgPath))
    .resize(supersample, supersample, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const resized = await sharp(base)
    .resize(coinSize, coinSize, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const highlight = await sharp(coinHighlightSvg(coinSize)).png().toBuffer();

  return sharp(resized)
    .composite([{ input: highlight, blend: "screen" }])
    .png()
    .toBuffer();
}

export async function createPremiumSocialPreview(coinSvgPath, outputPath) {
  const width = SOCIAL_WIDTH;
  const height = SOCIAL_HEIGHT;
  const coinSize = Math.round(width * COIN_WIDTH_RATIO);
  const coinLeft = Math.floor((width - coinSize) / 2);
  const coinTop = 20;
  const coinCx = width / 2;
  const coinCy = coinTop + coinSize / 2;

  const background = await sharp(backgroundSvg(width, height, coinCx, coinCy, coinSize)).png().toBuffer();
  const coin = await renderPremiumCoin(coinSvgPath, coinSize);
  const typography = await sharp(typographySvg(width, height)).png().toBuffer();

  await sharp({
    create: { width, height, channels: 4, background: { r: 13, g: 13, b: 13, alpha: 1 } },
  })
    .composite([
      { input: background, left: 0, top: 0 },
      { input: coin, left: coinLeft, top: coinTop },
      { input: typography, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}
