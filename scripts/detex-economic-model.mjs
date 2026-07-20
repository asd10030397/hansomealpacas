/**
 * Convert LaTeX math in economic-model markdown to plain Unicode
 * so browser MD views and the Playwright PDF path both read cleanly.
 *
 * Prefer hand-editing complex formulas after running this.
 *
 * Usage: node scripts/detex-economic-model.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "docs/HANSOME_GAME_ECONOMIC_MODEL_EN.md",
  "docs/HANSOME_GAME_ECONOMIC_MODEL_ZH.md",
];

function detexInner(src) {
  let s = src;

  // Fractions before brace stripping
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  s = s.replace(/\\tfrac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");

  s = s.replace(/\\underbrace\{([^{}]+)\}_\{\\text\{([^}]*)\}\}/g, "$1 ($2)");
  s = s.replace(/\\underbrace\{([^{}]+)\}_\{([^}]*)\}/g, "$1 ($2)");
  s = s.replace(/\\mathrm\{([^}]*)\}/g, "$1");
  s = s.replace(/\\text\{([^}]*)\}/g, "$1");
  s = s.replace(/\\displaystyle\s*/g, "");
  s = s.replace(/\\Big\\lfloor/g, "⌊");
  s = s.replace(/\\Big\\rfloor/g, "⌋");
  s = s.replace(/\\lfloor/g, "⌊");
  s = s.replace(/\\rfloor/g, "⌋");
  s = s.replace(/\\ge(?![a-zA-Z])/g, "≥");
  s = s.replace(/\\le(?![a-zA-Z])/g, "≤");
  s = s.replace(/\\neq(?![a-zA-Z])/g, "≠");
  s = s.replace(/\\approx(?![a-zA-Z])/g, "≈");
  s = s.replace(/\\cdot(?![a-zA-Z])/g, "·");
  s = s.replace(/\\times(?![a-zA-Z])/g, "×");
  s = s.replace(/\\mapsto(?![a-zA-Z])/g, "→");
  s = s.replace(/\\in(?![a-zA-Z])/g, "∈");
  s = s.replace(/\\sum(?![a-zA-Z])/g, "Σ");
  s = s.replace(/\\quad(?![a-zA-Z])/g, "  ");
  s = s.replace(/\\,\s*/g, " ");
  s = s.replace(/\\;/g, " ");
  s = s.replace(/\\%/g, "%");
  // Greek — no word-boundary (next char often `_`)
  s = s.replace(/\\pi(?![a-zA-Z])/g, "π");
  s = s.replace(/\\omega(?![a-zA-Z])/g, "ω");
  s = s.replace(/\\Omega(?![a-zA-Z])/g, "Ω");
  s = s.replace(/\\tau(?![a-zA-Z])/g, "τ");
  s = s.replace(/\\\{/g, "{");
  s = s.replace(/\\\}/g, "}");
  s = s.replace(/\{,\}/g, ",");
  s = s.replace(/\^\{([^}]*)\}/g, "^$1");
  s = s.replace(/_\{([^}]*)\}/g, "_$1");
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");
  s = s.replace(/[{}]/g, "");
  return s.replace(/[ \t]+\n/g, "\n").replace(/  +/g, " ").trim();
}

function detexMarkdown(md) {
  let out = md.replace(/\r\n/g, "\n");
  out = out.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, body) => {
    const plain = detexInner(body);
    return `\n\`\`\`text\n${plain}\n\`\`\`\n`;
  });
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => detexInner(body));
  return out.replace(/\n{3,}/g, "\n\n");
}

async function main() {
  for (const rel of FILES) {
    const p = path.join(rootDir, rel);
    const before = await readFile(p, "utf8");
    if (!/\\\(|\\\[/.test(before)) {
      console.log(`Skip ${rel} (no LaTeX delimiters)`);
      continue;
    }
    const after = detexMarkdown(before);
    await writeFile(p, after, "utf8");
    console.log(`Updated ${rel}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
