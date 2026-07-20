import type { VaultKv } from "@/lib/game/server/testnetCommitVaultTypes";

const memoryStrings = new Map<string, string>();
const memorySets = new Map<string, Set<string>>();

export function createMemoryVaultKv(
  strings: Map<string, string> = new Map(),
  sets: Map<string, Set<string>> = new Map(),
): VaultKv {
  return {
    async get(key) {
      return strings.get(key) ?? null;
    },
    async set(key, value) {
      strings.set(key, value);
    },
    async sadd(key, member) {
      let set = sets.get(key);
      if (!set) {
        set = new Set();
        sets.set(key, set);
      }
      set.add(member);
    },
    async smembers(key) {
      return [...(sets.get(key) ?? [])];
    },
  };
}

export function memoryVaultKv(): VaultKv {
  return createMemoryVaultKv(memoryStrings, memorySets);
}

export function resetMemoryVaultForTests(): void {
  memoryStrings.clear();
  memorySets.clear();
}
