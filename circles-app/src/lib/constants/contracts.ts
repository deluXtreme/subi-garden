// Contract addresses for Circles subscription system

export const HUB_ADDRESS =
  '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8' as const;
// TODO: No longer needed - was used for per-Safe module deployments
export const MODULE_PROXY_FACTORY =
  '0x000000000000aDdB49795b0f9bA5BC298cDda236' as const;

// Primary subscription contract - new simplified architecture
// SUBSCRIPTION_MODULE is a single deployed contract that all Safes can enable
// Each Safe simply enables this module instead of deploying their own instance
export const SUBSCRIPTION_MODULE =
  '0xcEbE4B6d50Ce877A9689ce4516Fe96911e099A78' as const;

// Network configuration
export const GNOSIS_RPC_URL = 'https://rpc.gnosischain.com/' as const;
export const SAFE_TRANSACTION_SERVICE_URL =
  'https://safe-transaction-gnosis-chain.safe.global/api/v1' as const;

// TODO: No longer needed - was used for deterministic address calculation in old architecture
export const DEFAULT_SALT = BigInt(
  '110647465789069657756111682142268192901188952877020749627246931254533522453'
);

// Token decimals (CRC tokens typically use 18 decimals)
export const CRC_DECIMALS = 18;
