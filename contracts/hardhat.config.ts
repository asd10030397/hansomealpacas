import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import dotenv from "dotenv";
import { resolveRobinhoodMainnetRpcUrl } from "./scripts/lib/robinhood-mainnet-rpc";

dotenv.config();

function envOr(primary: string | undefined, fallback: string): string {
  const value = primary?.trim();
  return value ? value : fallback;
}

const rawKey = (
  process.env.DEPLOYER_PRIVATE_KEY ??
  process.env.PRIVATE_KEY ??
  process.env.TREASURY_PRIVATE_KEY
)?.trim();
const normalizedKey =
  rawKey && !rawKey.startsWith("0x") ? `0x${rawKey}` : rawKey;

const accounts =
  normalizedKey && normalizedKey.startsWith("0x") && normalizedKey.length === 66
    ? [normalizedKey]
    : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    /**
     * Robinhood Chain Mainnet ONLY (chainId 4663).
     * RPC: https://rpc.mainnet.chain.robinhood.com
     * Prefer `--network mainnet`; `robinhood` is an alias.
     * Never use Testnet 46630 here — that is `robinhoodTestnet`.
     */
    mainnet: {
      url: resolveRobinhoodMainnetRpcUrl(process.env.RH_RPC_URL),
      chainId: 4663,
      accounts,
    },
    robinhood: {
      url: resolveRobinhoodMainnetRpcUrl(process.env.RH_RPC_URL),
      chainId: 4663,
      accounts,
    },
    robinhoodTestnet: {
      url: envOr(
        process.env.RH_TESTNET_RPC_URL,
        "https://rpc.testnet.chain.robinhood.com",
      ),
      chainId: 46630,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: "empty",
      robinhood: "empty",
      robinhoodTestnet: "empty",
    },
    customChains: [
      {
        network: "mainnet",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
      {
        network: "robinhood",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
    ],
  },
};

export default config;
