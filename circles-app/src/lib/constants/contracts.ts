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
  '0xD5dC464dD561782615D7495d1d7CEd301083c750' as const;

// TODO: No longer needed - legacy addresses from old per-Safe deployment architecture
export const SUBSCRIPTION_MASTER_COPY =
  '0x80242DCdc1bDfA3271D993cE3a4E568B54981E3C' as const;

// Legacy subscription manager - deprecated in favor of direct module interaction
export const SUBSCRIPTION_MANAGER =
  '0x7E9BaF7CC7cD83bACeFB9B2D5c5124C0F9c30834' as const;

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
