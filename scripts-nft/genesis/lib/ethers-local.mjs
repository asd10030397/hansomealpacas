import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(path.join(ROOT, "contracts/package.json"));
export const { keccak256, solidityPacked } = require("ethers");
