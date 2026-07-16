import sharp from "sharp";

export const W = 1024;
export const H = 1024;
export const CELL = 16; // 64x64 logical grid

// --- shared cozy countryside palette (RGBA) ---
export const P = {
  clear: [0, 0, 0, 0],
  outline: [54, 42, 26, 255],
  outlineSoft: [78, 62, 40, 255],

  strawL: [233, 196, 106, 255],
  strawM: [209, 164, 69, 255],
  strawD: [169, 122, 44, 255],

  woolL: [251, 243, 218, 255],
  woolM: [222, 208, 171, 255],
  woolD: [195, 178, 138, 255],

  redL: [210, 110, 96, 255],
  redM: [198, 91, 78, 255],
  redD: [158, 64, 52, 255],

  greenL: [143, 192, 106, 255],
  greenM: [106, 158, 79, 255],
  greenD: [79, 122, 56, 255],

  skyL: [210, 236, 247, 255],
  skyM: [159, 203, 230, 255],
  skyD: [120, 175, 214, 255],

  sun: [247, 216, 130, 255],
  sunCore: [252, 232, 170, 255],

  sunsetTop: [246, 194, 122, 255],
  sunsetMid: [240, 150, 120, 255],
  sunsetLow: [232, 138, 150, 255],
  lavender: [201, 179, 224, 255],

  woodL: [169, 119, 63, 255],
  woodM: [124, 83, 38, 255],
  woodD: [92, 60, 26, 255],

  denimL: [110, 145, 186, 255],
  denimM: [90, 123, 166, 255],
  denimD: [63, 91, 130, 255],

  purpL: [177, 156, 217, 255],
  purpM: [138, 111, 176, 255],
  purpD: [104, 80, 140, 255],

  berryL: [209, 106, 140, 255],
  berryM: [176, 68, 106, 255],
  berryD: [130, 44, 74, 255],

  goldL: [232, 193, 90, 255],
  goldM: [201, 158, 47, 255],
  goldD: [150, 113, 30, 255],

  pink: [242, 168, 192, 255],
  pinkD: [214, 120, 150, 255],

  white: [250, 248, 240, 255],
  yolk: [245, 206, 90, 255],

  lensDark: [46, 52, 62, 255],
  lensHi: [92, 104, 120, 255],

  leafL: [150, 194, 110, 255],
  leafD: [96, 146, 74, 255],

  navy: [30, 38, 66, 255],
  navyL: [52, 62, 100, 255],
};

export function createCanvas() {
  return Buffer.alloc(W * H * 4, 0);
}

// absolute-pixel fill
export function fillPx(buf, x, y, w, h, color) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = color[3];
    }
  }
}

// grid-cell fill (gx,gy in cells, gw,gh in cells)
export function g(buf, gx, gy, gw = 1, gh = 1, color) {
  fillPx(buf, gx * CELL, gy * CELL, gw * CELL, gh * CELL, color);
}

// single cell
export function dot(buf, gx, gy, color) {
  g(buf, gx, gy, 1, 1, color);
}

// stamp a char-grid sprite. rows: array of equal-length strings. pal: {char:color}. '.' or ' ' = skip.
export function stamp(buf, gx0, gy0, rows, pal) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === "." || ch === " ") continue;
      const color = pal[ch];
      if (!color) continue;
      dot(buf, gx0 + c, gy0 + r, color);
    }
  }
}

// rounded-rect border (outline) with optional fill. grid units.
export function ring(buf, gx, gy, gw, gh, outline, fill = null) {
  if (fill) g(buf, gx, gy, gw, gh, fill);
  g(buf, gx, gy, gw, 1, outline); // top
  g(buf, gx, gy + gh - 1, gw, 1, outline); // bottom
  g(buf, gx, gy, 1, gh, outline); // left
  g(buf, gx + gw - 1, gy, 1, gh, outline); // right
}

// Mini-sprite authored in its own small grid, with automatic clean outlining.
export class Sprite {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h).fill(null);
  }
  idx(x, y) {
    return y * this.w + x;
  }
  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x, y, color) {
    if (this.inb(x, y)) this.cells[this.idx(x, y)] = color;
  }
  get(x, y) {
    return this.inb(x, y) ? this.cells[this.idx(x, y)] : null;
  }
  // horizontal span, inclusive x0..x1
  span(y, x0, x1, color) {
    for (let x = x0; x <= x1; x++) this.set(x, y, color);
  }
  rect(x0, y0, x1, y1, color) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, color);
  }
  // add outline color in transparent cells orthogonally adjacent to any filled cell
  autoOutline(color, diagonal = false) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== null) continue;
        const n = [
          [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
        ];
        if (diagonal) n.push([x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]);
        let touch = false;
        for (const [nx, ny] of n) {
          const c = this.get(nx, ny);
          if (c !== null && c !== color) {
            touch = true;
            break;
          }
        }
        if (touch) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, color);
    return this;
  }
  blit(buf, gx0, gy0) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.cells[this.idx(x, y)];
        if (c) dot(buf, gx0 + x, gy0 + y, c);
      }
    }
  }
}

export async function save(buf, outPath) {
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}
