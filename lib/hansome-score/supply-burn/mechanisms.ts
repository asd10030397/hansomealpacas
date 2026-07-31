import type {
  AbiItem,
  BurnMechanismDetection,
  SupplyBurnFinding,
  TriState,
} from "@/lib/hansome-score/supply-burn/types";

/** Strip Solidity comments/strings so NatSpec cannot false-positive. */
export function stripSolidityNoise(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function abiFns(abi: AbiItem[] | null): AbiItem[] {
  if (!abi) return [];
  return abi.filter((x) => x.type === "function" && x.name);
}

function hasAbiFn(abi: AbiItem[] | null, names: string[]): boolean {
  const set = new Set(abiFns(abi).map((x) => x.name!.toLowerCase()));
  return names.some((n) => set.has(n.toLowerCase()));
}

function findAbiFn(abi: AbiItem[] | null, name: string): AbiItem | undefined {
  const lc = name.toLowerCase();
  return abiFns(abi).find((x) => x.name!.toLowerCase() === lc);
}

/**
 * Extract a function body slice roughly matching `function <name>(...) ... { ... }`.
 * Best-effort for verified primary source; modifiers unclear → caller prefers Unknown.
 */
function functionSnippet(source: string, name: string): string | null {
  const code = stripSolidityNoise(source);
  const re = new RegExp(
    `\\bfunction\\s+${name}\\s*\\([^)]*\\)([^{;]*)\\{`,
    "i",
  );
  const m = code.match(re);
  if (!m) return null;
  return `${m[0]}${m[1] ?? ""}`;
}

function snippetHasPrivilegeGuard(snippet: string): boolean {
  return (
    /\bonlyOwner\b/i.test(snippet) ||
    /\bonlyRole\s*\(/i.test(snippet) ||
    /\bonlyAdmin\b/i.test(snippet) ||
    /\brequire\s*\(\s*(msg\.sender\s*==\s*owner|isOwner|_checkOwner)/i.test(
      snippet,
    )
  );
}

function sourceMentions(source: string | null, patterns: RegExp[]): boolean {
  if (!source) return false;
  const code = stripSolidityNoise(source);
  return patterns.some((p) => p.test(code));
}

/**
 * Detect burn mechanism surfaces from verified ABI + source.
 * Unverified / missing ABI+source → all Unknown.
 * Never infer from inaccessible wallets.
 */
export function detectBurnMechanisms(input: {
  verified: boolean | null;
  abi: AbiItem[] | null;
  sourceCode: string | null;
}): BurnMechanismDetection {
  const findings: SupplyBurnFinding[] = [];
  const notes: string[] = [];

  if (input.verified !== true || (!input.abi && !input.sourceCode)) {
    notes.push(
      "Burn mechanism analysis incomplete — missing verified ABI/source. Unknown ≠ safe.",
    );
    findings.push({
      code: "burn_mechanism_incomplete",
      severity: "warning",
      message:
        "Burn mechanism Unknown — contract not verified or ABI/source unavailable.",
      source: "provisional",
    });
    return {
      holderBurnCallable: "unknown",
      burnFromPresent: "unknown",
      automaticBurn: "unknown",
      privilegedBurn: "unknown",
      findings,
      notes,
    };
  }

  const abi = input.abi;
  const source = input.sourceCode;
  const code = source ? stripSolidityNoise(source) : "";

  // --- burnFrom ---
  const burnFromAbi = hasAbiFn(abi, ["burnFrom"]);
  const burnFromSource = sourceMentions(source, [
    /\bfunction\s+burnFrom\s*\(/i,
  ]);
  let burnFromPresent: TriState = burnFromAbi || burnFromSource ? "yes" : "no";

  // --- Privileged / admin burn (arbitrary holders) ---
  let privilegedBurn: TriState = "no";
  const privilegedPatterns: RegExp[] = [
    /\bfunction\s+(forceBurn|adminBurn|burnFromOwner|confiscate|seize)\s*\(/i,
    /\bfunction\s+burn\s*\(\s*address\b/i,
  ];
  const privilegedNameHit = sourceMentions(source, privilegedPatterns);

  const burnAddrFn = findAbiFn(abi, "burn");
  const burnTakesAddress =
    burnAddrFn?.inputs?.some((i) => (i.type ?? "").toLowerCase() === "address") ??
    false;

  // onlyOwner burn(address,...) or burnFrom with privilege guard
  let privilegedFromModifiers = false;
  if (source) {
    for (const name of ["burn", "burnFrom", "forceBurn", "adminBurn", "confiscate"]) {
      const snip = functionSnippet(source, name);
      if (!snip) continue;
      if (!snippetHasPrivilegeGuard(snip)) continue;
      // Privileged if burns another's tokens (address arg) or non-standard admin burn name
      const isAdminNamed = !["burn", "burnFrom"].includes(name.toLowerCase());
      const hasAddressArg = /\(\s*address\b/i.test(snip);
      if (isAdminNamed || hasAddressArg) {
        privilegedFromModifiers = true;
        break;
      }
      // onlyOwner burn(uint256) burns owner's own balance — not arbitrary-holder confiscation
    }
  }

  // ABI-only: burn(address,uint256) strongly suggests privileged surface when Ownable present
  const hasOwnerSurface =
    hasAbiFn(abi, ["owner", "getOwner", "transferOwnership"]) ||
    sourceMentions(source, [/\bOwnable\b/, /\bonlyOwner\b/]);

  if (privilegedNameHit || privilegedFromModifiers) {
    privilegedBurn = "yes";
  } else if (burnTakesAddress && hasOwnerSurface) {
    // ABI says burn(address,...) + owner surface; modifiers not proven → Unknown
    if (source) {
      const snip = functionSnippet(source, "burn");
      if (snip && snippetHasPrivilegeGuard(snip)) {
        privilegedBurn = "yes";
      } else if (snip && !snippetHasPrivilegeGuard(snip)) {
        privilegedBurn = "no";
      } else {
        privilegedBurn = "unknown";
        notes.push(
          "ABI exposes burn(address,…) with owner surface but modifiers unclear.",
        );
      }
    } else {
      privilegedBurn = "unknown";
      notes.push(
        "ABI exposes burn(address,…) but source unavailable to confirm privilege.",
      );
    }
  }

  // burnFrom with onlyOwner / onlyRole (not standard allowance ERC20Burnable)
  if (source && burnFromPresent === "yes") {
    const snip = functionSnippet(source, "burnFrom");
    if (snip && snippetHasPrivilegeGuard(snip)) {
      privilegedBurn = "yes";
    }
  }

  // --- Holder-accessible burn() ---
  let holderBurnCallable: TriState = "no";
  const holderBurnAbi =
    hasAbiFn(abi, ["burn", "burnToken"]) && !burnTakesAddress;
  const holderBurnSource = sourceMentions(source, [
    /\bfunction\s+burn\s*\(\s*uint256\b/i,
    /\bfunction\s+burnToken\s*\(/i,
  ]);

  if (holderBurnAbi || holderBurnSource) {
    if (source) {
      const snip =
        functionSnippet(source, "burn") ?? functionSnippet(source, "burnToken");
      if (snip && snippetHasPrivilegeGuard(snip) && !/\baddress\b/i.test(snip)) {
        // onlyOwner burn(uint256) — owner can burn own tokens; not holder-callable
        holderBurnCallable = "no";
      } else if (snip && snippetHasPrivilegeGuard(snip)) {
        holderBurnCallable = "no";
      } else if (snip) {
        holderBurnCallable = "yes";
      } else if (holderBurnAbi) {
        // ABI has burn(uint256) but no matching source snippet — conservative Unknown
        holderBurnCallable = "unknown";
        notes.push("burn(uint256) in ABI but source snippet not located.");
      } else {
        holderBurnCallable = "unknown";
      }
    } else if (holderBurnAbi) {
      holderBurnCallable = "unknown";
      notes.push("burn in ABI without source — cannot confirm holder accessibility.");
    }
  }

  // ERC20Burnable inheritance without local burn() override
  if (
    holderBurnCallable === "no" &&
    sourceMentions(source, [/\bERC20Burnable\b/]) &&
    !sourceMentions(source, [/\bfunction\s+burn\s*\(/i])
  ) {
    holderBurnCallable = "yes";
    burnFromPresent = "yes";
    notes.push("ERC20Burnable inheritance implies holder burn() / burnFrom().");
  }

  // --- Automatic / transfer-tax burn ---
  let automaticBurn: TriState = "no";
  const autoPatterns = [
    // fee/tax path that burns
    /\b_burn\s*\([^)]*\)/i,
    /\bburnAmount\b/i,
    /\btax.*burn|burn.*tax/i,
    /\bfee.*(?:dead|burn)|(?:dead|burn).*fee/i,
    /0x0{38}[dD][eE][aA][dD]/,
    /address\s*\(\s*0(x0+)?\s*\).*burn|burn.*address\s*\(\s*0/i,
  ];

  // Require burn call inside transfer/_update/_transfer context when possible
  const hasTransferHook = sourceMentions(source, [
    /\bfunction\s+_update\s*\(/i,
    /\bfunction\s+_transfer\s*\(/i,
    /\bfunction\s+transfer\s*\(/i,
    /\bfunction\s+_beforeTokenTransfer\s*\(/i,
  ]);
  const hasAutoBurnSignal = sourceMentions(source, autoPatterns);

  if (hasAutoBurnSignal && hasTransferHook) {
    // Distinguish constructor-only _mint/_burn from transfer tax burn:
    // look for _burn or dead send near fee/tax words outside constructor
    const autoInFeePath = sourceMentions(source, [
      /\b(fee|tax|burnFee|burnRate|burnPercent)\b[\s\S]{0,200}\b_burn\s*\(/i,
      /\b_burn\s*\([\s\S]{0,120}\b(fee|tax|burnFee)\b/i,
      /\b(fee|tax)\b[\s\S]{0,200}0x0{38}[dD][eE][aA][dD]/i,
      /\b_transfer\s*\([\s\S]{0,400}\b_burn\s*\(/i,
      /\b_update\s*\([\s\S]{0,400}\b_burn\s*\(/i,
    ]);
    if (autoInFeePath) {
      automaticBurn = "yes";
    } else if (
      // Reflect/rebase style with burn on transfer is ambiguous without simulation
      sourceMentions(source, [/\breflect\b/i, /\brTotal\b/, /\b_rTotal\b/]) &&
      hasAutoBurnSignal
    ) {
      automaticBurn = "unknown";
      notes.push("Reflect/rebase + burn signals — automatic burn left Unknown.");
    } else if (
      // Isolated _burn in non-transfer helpers (e.g. public burn) should not flag auto
      sourceMentions(source, [
        /\bfunction\s+burn\s*\([^)]*\)[^{]*\{[^}]*_burn\s*\(/i,
      ]) &&
      !autoInFeePath
    ) {
      automaticBurn = "no";
    } else {
      // _burn present with transfer hooks but fee path unclear
      const onlyInBurnFn =
        /\b_burn\s*\(/.test(code) &&
        !/\b(fee|tax|burnFee|burnRate)\b/i.test(code);
      automaticBurn = onlyInBurnFn ? "no" : "unknown";
      if (automaticBurn === "unknown") {
        notes.push(
          "Transfer hooks + burn primitives present but automatic fee-burn path unclear.",
        );
      }
    }
  } else if (hasAutoBurnSignal && !hasTransferHook) {
    automaticBurn = "unknown";
    notes.push("Burn primitives found without clear transfer/tax path.");
  }

  if (privilegedBurn === "yes") {
    findings.push({
      code: "privileged_burn",
      severity: "risk",
      message:
        "Privileged/admin burn surface detected — ability to burn or confiscate from arbitrary holders.",
      source: "abi_source",
    });
  }
  if (holderBurnCallable === "yes") {
    findings.push({
      code: "holder_burn",
      severity: "info",
      message: "Holder-accessible burn() detected (voluntary; not a Score boost).",
      source: "abi_source",
    });
  }
  if (burnFromPresent === "yes") {
    findings.push({
      code: "burn_from",
      severity: "info",
      message: "burnFrom() present in ABI/source.",
      source: "abi_source",
    });
  }
  if (automaticBurn === "yes") {
    findings.push({
      code: "automatic_burn",
      severity: "warning",
      message:
        "Automatic / transfer-tax burn path detected (disclosure; not a Structural reward).",
      source: "abi_source",
    });
  }

  void notes; // kept on return
  return {
    holderBurnCallable,
    burnFromPresent,
    automaticBurn,
    privilegedBurn,
    findings,
    notes,
  };
}

/**
 * Primary “Burn Function” flag: Yes if burn() and/or burnFrom() present.
 * Unknown wins over No when either side is incomplete.
 */
export function combineBurnFunction(
  holderBurnCallable: TriState,
  burnFromPresent: TriState,
): TriState {
  if (holderBurnCallable === "yes" || burnFromPresent === "yes") return "yes";
  if (holderBurnCallable === "unknown" || burnFromPresent === "unknown") {
    return "unknown";
  }
  return "no";
}

export function classifyBurnMechanism(input: {
  knownBurnedRaw: bigint | null;
  mechanisms: BurnMechanismDetection;
}): import("@/lib/hansome-score/supply-burn/types").BurnMechanism {
  const { mechanisms: m, knownBurnedRaw } = input;
  if (
    m.holderBurnCallable === "unknown" &&
    m.burnFromPresent === "unknown" &&
    m.automaticBurn === "unknown" &&
    m.privilegedBurn === "unknown"
  ) {
    if (knownBurnedRaw != null && knownBurnedRaw > 0n) return "dead_address_only";
    return "unknown";
  }

  const flags: import("@/lib/hansome-score/supply-burn/types").BurnMechanism[] =
    [];
  if (m.privilegedBurn === "yes") flags.push("privileged_burn");
  if (m.automaticBurn === "yes") flags.push("automatic_transfer_burn");
  if (m.holderBurnCallable === "yes") flags.push("holder_burn");
  if (m.burnFromPresent === "yes") flags.push("burn_from");
  if (knownBurnedRaw != null && knownBurnedRaw > 0n) flags.push("dead_address_only");

  if (flags.length === 0) return "none_detected";
  if (flags.length === 1) return flags[0]!;
  return "mixed";
}
