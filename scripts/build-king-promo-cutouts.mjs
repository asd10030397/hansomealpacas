/**
 * Build transparent cutouts for the King promo trailer.
 *
 * Alpacas: difference against their known trait background layer (exact pixel art).
 * Cougar: edge flood-fill keyed to scene backdrop colors, then keep largest body.
 *
 * Output: public/assets/promo/king/*.png (RGBA, nearest-neighbor preserved)
 *
 * Usage: node scripts/build-king-promo-cutouts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "assets", "promo", "king");

const JOBS = [
  {
    id: "king",
    src: "public/pixel/genesis/collection-550/image/1.png",
    bg: "public/pixel/traits/backgrounds/king.png",
    mode: "bgDiff",
    /** Tight — pixel art backgrounds are exact composites. */
    maxDist: 6,
  },
  {
    id: "prey-a",
    src: "public/pixel/genesis/collection-550/image/100.png",
    bg: "public/pixel/traits/backgrounds/morning-sky.png",
    mode: "bgDiff",
    maxDist: 6,
  },
  {
    id: "prey-b",
    src: "public/pixel/genesis/collection-550/image/250.png",
    bg: "public/pixel/traits/backgrounds/morning-sky.png",
    mode: "bgDiff",
    maxDist: 6,
  },
  {
    id: "cougar",
    src: "public/pixel/cougar/mint/image/cougar.png",
    mode: "cougarScene",
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function dist3(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

async function loadRgba(relPath, size = 1024) {
  const abs = path.join(root, relPath);
  const { data, info } = await sharp(abs)
    .ensureAlpha()
    .resize(size, size, { kernel: "nearest", fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function cutoutByBackgroundDiff(job) {
  const fg = await loadRgba(job.src);
  const bg = await loadRgba(job.bg);
  const out = Buffer.from(fg.data);
  let cleared = 0;
  for (let i = 0; i < out.length; i += 4) {
    const d = dist3(
      out[i],
      out[i + 1],
      out[i + 2],
      bg.data[i],
      bg.data[i + 1],
      bg.data[i + 2],
    );
    if (d <= job.maxDist) {
      out[i + 3] = 0;
      cleared++;
    }
  }
  // Drop tiny leftover sparkle islands (not connected to main subject).
  removeSmallOpaqueIslands(out, fg.width, fg.height, 80);
  scrubTransparentRgb(out);
  return { data: out, width: fg.width, height: fg.height, cleared };
}

/**
 * Cougar mint art is a full scene. Grow the subject from the torso center
 * using a warm-fur / outline classifier, then clear everything else.
 */
function isCougarGround(r, g, b) {
  // Olive / yellow grass and dirt plate under the paws
  if (g > 52 && g >= r - 8 && g > b + 4 && r < 155 && b < 110) return true;
  if (g > 65 && r > 55 && r < 160 && b < 95 && Math.abs(r - g) < 28) return true;
  return false;
}

function isCougarBodyPixel(r, g, b) {
  if (isCougarGround(r, g, b)) return false;
  // Teeth / sclera / claws
  if (r > 190 && g > 185 && b > 160 && Math.abs(r - g) < 40) return true;
  // Yellow eye
  if (r > 160 && g > 120 && b < 130 && r > b + 35 && g > b + 15) return true;
  // Pink nose / gums / tongue
  if (r > 110 && g < 120 && b < 120 && r > g + 12 && r > b + 12) return true;
  // Dark mouth cavity / outline (warm-neutral, not cool mountain slate)
  if (r < 85 && g < 75 && b < 70 && r + 10 >= b && g + 14 >= b) return true;
  // Warm tan / ochre fur — exclude green grass and cool greys
  if (g > r + 6) return false;
  if (b > r + 10) return false;
  if (r < 45 || g < 28) return false;
  if (b > 110) return false;
  if (r >= g - 4 && r > b + 8 && g >= b - 2) return true;
  return false;
}

/** Fill interior holes (e.g. mouth cavity) so alpha doesn't punch through the body. */
function fillKeepHoles(keep, width, height) {
  const n = width * height;
  const outside = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  const push = (idx) => {
    if (outside[idx] || keep[idx]) return;
    outside[idx] = 1;
    queue[qt++] = idx;
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + (width - 1));
  }
  while (qh < qt) {
    const idx = queue[qh++];
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      push(ny * width + nx);
    }
  }
  for (let i = 0; i < n; i++) {
    if (!keep[i] && !outside[i]) keep[i] = 1;
  }
}

async function cutoutCougarScene(job) {
  const { data, width, height } = await loadRgba(job.src);
  const out = Buffer.from(data);
  const n = width * height;
  const keep = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;

  // Seed near the torso (mint art places the body center-left of canvas).
  const seeds = [
    [Math.floor(width * 0.48), Math.floor(height * 0.52)],
    [Math.floor(width * 0.42), Math.floor(height * 0.48)],
    [Math.floor(width * 0.55), Math.floor(height * 0.45)],
    [Math.floor(width * 0.5), Math.floor(height * 0.6)],
  ];
  for (const [sx, sy] of seeds) {
    const idx = sy * width + sx;
    const p = idx * 4;
    if (isCougarBodyPixel(out[p], out[p + 1], out[p + 2])) {
      if (!keep[idx]) {
        keep[idx] = 1;
        queue[qt++] = idx;
      }
    }
  }
  if (qt === 0) {
    throw new Error("Cougar cutout: no body seed found — adjust seed points");
  }

  while (qh < qt) {
    const idx = queue[qh++];
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
      [x - 1, y - 1],
      [x + 1, y - 1],
      [x - 1, y + 1],
      [x + 1, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nidx = ny * width + nx;
      if (keep[nidx]) continue;
      const np = nidx * 4;
      if (!isCougarBodyPixel(out[np], out[np + 1], out[np + 2])) continue;
      keep[nidx] = 1;
      queue[qt++] = nidx;
    }
  }

  // Close 1px tunnels so outside-flood hole fill can't leak into the torso.
  dilateKeep(keep, width, height);
  fillKeepHoles(keep, width, height);
  // Neighbor majority + row/col span fill patches residual torso holes.
  for (let pass = 0; pass < 4; pass++) {
    fillKeepByNeighbors(keep, width, height, 4);
  }
  fillKeepSpans(keep, width, height, 36);

  // Final sweep: drop grass/dirt plate pixels attached during body grow.
  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    const p = i * 4;
    if (isCougarGround(out[p], out[p + 1], out[p + 2])) keep[i] = 0;
  }

  let cleared = 0;
  for (let i = 0; i < n; i++) {
    if (!keep[i]) {
      out[i * 4 + 3] = 0;
      cleared++;
    }
  }

  // Kill residual letterbox / vignette blacks left opaque by the body grow.
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (out[p + 3] === 0) continue;
    const max = Math.max(out[p], out[p + 1], out[p + 2]);
    if (max <= 28) {
      out[p + 3] = 0;
      cleared++;
    }
  }

  // Soft-trim dark contact shadow in the bottom band (keeps paws).
  const yShadow = Math.floor(height * 0.88);
  for (let y = yShadow; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (out[p + 3] === 0) continue;
      const r = out[p];
      const g = out[p + 1];
      const b = out[p + 2];
      const max = Math.max(r, g, b);
      if (max < 70 || (g >= r - 6 && g > b + 2 && g > 45 && r < 130)) {
        out[p + 3] = 0;
        cleared++;
      }
    }
  }

  removeSmallOpaqueIslands(out, width, height, 1200);
  return { data: out, width, height, cleared };
}

function dilateKeep(keep, width, height) {
  const n = width * height;
  const next = new Uint8Array(keep);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (keep[idx]) continue;
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (keep[(y + dy) * width + (x + dx)]) {
            hit = true;
            break;
          }
        }
      }
      if (hit) next[idx] = 1;
    }
  }
  keep.set(next);
}

function fillKeepByNeighbors(keep, width, height, minNeighbors) {
  const add = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (keep[idx]) continue;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (keep[(y + dy) * width + (x + dx)]) c++;
        }
      }
      if (c >= minNeighbors) add.push(idx);
    }
  }
  for (const idx of add) keep[idx] = 1;
}

/** Fill short transparent gaps between keep pixels on the same row/column. */
function fillKeepSpans(keep, width, height, maxGap) {
  for (let y = 0; y < height; y++) {
    let prev = -1;
    for (let x = 0; x < width; x++) {
      if (!keep[y * width + x]) continue;
      if (prev >= 0 && x - prev > 1 && x - prev - 1 <= maxGap) {
        for (let gx = prev + 1; gx < x; gx++) keep[y * width + gx] = 1;
      }
      prev = x;
    }
  }
  for (let x = 0; x < width; x++) {
    let prev = -1;
    for (let y = 0; y < height; y++) {
      if (!keep[y * width + x]) continue;
      if (prev >= 0 && y - prev > 1 && y - prev - 1 <= maxGap) {
        for (let gy = prev + 1; gy < y; gy++) keep[gy * width + x] = 1;
      }
      prev = y;
    }
  }
}

/** Remove opaque connected components smaller than minPixels (sparkles/noise). */
function removeSmallOpaqueIslands(rgba, width, height, minPixels) {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);

  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    if (rgba[start * 4 + 3] === 0) {
      seen[start] = 1;
      continue;
    }
    let sh = 0;
    stack[sh++] = start;
    seen[start] = 1;
    const comp = [];
    while (sh > 0) {
      const idx = stack[--sh];
      comp.push(idx);
      const x = idx % width;
      const y = (idx / width) | 0;
      const neigh = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neigh) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nidx = ny * width + nx;
        if (seen[nidx]) continue;
        if (rgba[nidx * 4 + 3] === 0) {
          seen[nidx] = 1;
          continue;
        }
        seen[nidx] = 1;
        stack[sh++] = nidx;
      }
    }
    if (comp.length < minPixels) {
      for (const idx of comp) rgba[idx * 4 + 3] = 0;
    }
  }
}

/** Zero RGB on transparent pixels so no leftover bg color leaks in bad viewers. */
function scrubTransparentRgb(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] !== 0) continue;
    rgba[i] = 0;
    rgba[i + 1] = 0;
    rgba[i + 2] = 0;
  }
}

async function writeCutout(id, rgba, width, height) {
  scrubTransparentRgb(rgba);
  // Content bbox + margin (sharper than sharp.trim for sparse edge pixels).
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error(`${id}: empty cutout`);

  const margin = 8;
  const left = Math.max(0, minX - margin);
  const top = Math.max(0, minY - margin);
  const right = Math.min(width - 1, maxX + margin);
  const bottom = Math.min(height - 1, maxY + margin);
  const cropW = right - left + 1;
  const cropH = bottom - top + 1;

  const cropped = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const srcOff = ((top + y) * width + left) * 4;
    const dstOff = y * cropW * 4;
    rgba.copy(cropped, dstOff, srcOff, srcOff + cropW * 4);
  }

  const trimmed = await sharp(cropped, {
    raw: { width: cropW, height: cropH, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outPath = path.join(outDir, `${id}.png`);
  fs.writeFileSync(outPath, trimmed);
  const meta = await sharp(trimmed).metadata();
  console.log(
    `✓ ${id}.png  ${meta.width}×${meta.height}  alpha=${meta.hasAlpha}`,
  );
  return outPath;
}

async function main() {
  ensureDir(outDir);
  console.log("Building King promo cutouts →", outDir);

  for (const job of JOBS) {
    const result =
      job.mode === "bgDiff"
        ? await cutoutByBackgroundDiff(job)
        : await cutoutCougarScene(job);
    console.log(
      `  ${job.id}: cleared ${result.cleared} px (${((result.cleared / (result.width * result.height)) * 100).toFixed(1)}%)`,
    );
    await writeCutout(job.id, result.data, result.width, result.height);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
