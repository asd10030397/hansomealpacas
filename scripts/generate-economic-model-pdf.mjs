/**
 * Render docs/HANSOME_GAME_ECONOMIC_MODEL_{EN,ZH}.md → PDF
 * (also copies into public/docs/ for https://game.hansomealpacas.xyz/docs/…).
 *
 * Usage: node scripts/generate-economic-model-pdf.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(rootDir, "docs");
const PUBLIC_DOCS = path.join(rootDir, "public", "docs");

const JOBS = [
  {
    md: "HANSOME_GAME_ECONOMIC_MODEL_EN.md",
    pdf: "HANSOME_GAME_ECONOMIC_MODEL_EN.pdf",
    lang: "en",
  },
  {
    md: "HANSOME_GAME_ECONOMIC_MODEL_ZH.md",
    pdf: "HANSOME_GAME_ECONOMIC_MODEL_ZH.pdf",
    lang: "zh-Hant",
  },
];

/** Minimal Markdown → HTML (headings, tables, code, lists, paragraphs, hr). */
function mdToHtml(md, lang) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let inTable = false;
  let tableRows = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    out.push("<table>");
    tableRows.forEach((row, idx) => {
      const cells = row
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      if (idx === 1 && cells.every((c) => /^:?-+:?$/.test(c))) return;
      const tag = idx === 0 ? "th" : "td";
      out.push(
        "<tr>" +
          cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") +
          "</tr>",
      );
    });
    out.push("</table>");
    tableRows = [];
    inTable = false;
  };

  const inline = (s) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2">$1</a>',
      );

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${codeBuf.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushTable();
        inCode = true;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    if (line.trim().startsWith("|")) {
      inTable = true;
      tableRows.push(line);
      i++;
      continue;
    }
    if (inTable) flushTable();

    if (line.startsWith("# ")) {
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (/^---+$/.test(line.trim())) {
      out.push("<hr/>");
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(`<li>${inline(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    } else if (line.trim() === "") {
      /* skip */
    } else if (line.trim() === "\\[" || line.trim() === "$$") {
      const buf = [];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "\\]" &&
        lines[i].trim() !== "$$"
      ) {
        buf.push(lines[i]);
        i++;
      }
      out.push(`<pre class="math">${inline(buf.join("\n"))}</pre>`);
    } else if (line.trim().startsWith("\\[") && line.includes("\\]")) {
      out.push(
        `<pre class="math">${inline(line.replace(/^\\\[/, "").replace(/\\\]$/, ""))}</pre>`,
      );
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
    i++;
  }
  flushTable();

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<title>HANSOME GameFi Economic Model</title>
<style>
  @page { margin: 18mm 16mm; }
  body {
    font-family: "Segoe UI", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1a1a1a;
    max-width: 720px;
    margin: 0 auto;
  }
  h1 { font-size: 1.55rem; margin: 0 0 0.6rem; color: #0f172a; }
  h2 { font-size: 1.2rem; margin: 1.6rem 0 0.55rem; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem; }
  h3 { font-size: 1.05rem; margin: 1.2rem 0 0.4rem; color: #334155; }
  p { margin: 0.45rem 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.75rem 0 1rem; font-size: 0.92em; }
  th, td { border: 1px solid #cbd5e1; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 0.88em; background: #f8fafc; padding: 0.05em 0.3em; border-radius: 3px; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem 0.9rem; overflow-x: auto; font-size: 0.82em; line-height: 1.4; }
  pre.math { background: #fafafa; white-space: pre-wrap; }
  ul, ol { margin: 0.4rem 0 0.7rem 1.2rem; }
  a { color: #b45309; text-decoration: none; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.2rem 0; }
  strong { color: #0f172a; }
</style>
</head>
<body>
${out.join("\n")}
</body>
</html>`;
}

async function main() {
  await mkdir(DOCS, { recursive: true });
  await mkdir(PUBLIC_DOCS, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();

  try {
    for (const job of JOBS) {
      const mdPath = path.join(DOCS, job.md);
      if (!existsSync(mdPath)) throw new Error(`Missing ${mdPath}`);
      const md = await readFile(mdPath, "utf8");
      const html = mdToHtml(md, job.lang);
      const htmlPath = path.join(DOCS, `._tmp_${job.pdf}.html`);
      await writeFile(htmlPath, html, "utf8");

      const page = await browser.newPage();
      await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, {
        waitUntil: "load",
      });
      const pdfPath = path.join(DOCS, job.pdf);
      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
      });
      await page.close();
      await copyFile(pdfPath, path.join(PUBLIC_DOCS, job.pdf));
      await copyFile(mdPath, path.join(PUBLIC_DOCS, job.md));
      await unlink(htmlPath).catch(() => {});
      console.log("Wrote", pdfPath);
      console.log("Copied", path.join(PUBLIC_DOCS, job.pdf));
      console.log("Copied", path.join(PUBLIC_DOCS, job.md));
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
