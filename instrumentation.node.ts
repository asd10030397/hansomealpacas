/**
 * Node-only instrumentation side effects.
 * Imported exclusively from instrumentation.ts after a NEXT_RUNTIME === "nodejs" guard.
 */

import "server-only";

import { reportGaslessProductionConfig } from "@/lib/game/server/gaslessProductionConfig";

reportGaslessProductionConfig();
