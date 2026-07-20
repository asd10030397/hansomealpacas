/**
 * Node-only instrumentation side effects.
 * Imported exclusively from instrumentation.ts after a NEXT_RUNTIME === "nodejs" guard.
 */

import "server-only";

import { assertProductionGameAddresses } from "@/lib/game/contractAddresses";
import { assertGameNetworkConfig } from "@/lib/game/gameNetwork";
import { reportGaslessProductionConfig } from "@/lib/game/server/gaslessProductionConfig";

// Network checks run inside assertProductionGameAddresses for Mainnet/Production;
// call explicitly so Preview Mainnet misconfig still fails closed when chain=4663.
assertGameNetworkConfig();
assertProductionGameAddresses();
reportGaslessProductionConfig();
