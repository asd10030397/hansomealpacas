import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const artifactsDir = path.resolve(root, "..", "..", "artifacts");
const dest = path.join(artifactsDir, "hansome-game-debug.apk");

if (!existsSync(src)) {
  console.error("Debug APK not found:", src);
  process.exit(1);
}

mkdirSync(artifactsDir, { recursive: true });
copyFileSync(src, dest);

const buf = await import("node:fs/promises").then((fs) => fs.readFile(dest));
const sha256 = createHash("sha256").update(buf).digest("hex");
const size = statSync(dest).size;

console.log(JSON.stringify({ src, dest, sha256, sizeBytes: size }, null, 2));
