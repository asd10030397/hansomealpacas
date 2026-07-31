export type {
  HookForeignLpSeparation,
  HookForeignLpSeparationPublic,
  HookForeignLpTerminalState,
  HookForeignLpBucket,
} from "@/lib/hansome-score/lp/hook-foreign-lp/types";

export {
  separateForeignLp,
  toPublicForeignLpSeparation,
  classifyForeignOwner,
  positionOwnerKey,
} from "@/lib/hansome-score/lp/hook-foreign-lp/separate";
