// Contract addresses for Circles subscription system

export const HUB_ADDRESS = '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8' as const;
export const MODULE_PROXY_FACTORY = '0x000000000000aDdB49795b0f9bA5BC298cDda236' as const;
export const SUBSCRIPTION_MANAGER = '0x7E9BaF7CC7cD83bACeFB9B2D5c5124C0F9c30834' as const;
export const SUBSCRIPTION_MASTER_COPY = '0x80242DCdc1bDfA3271D993cE3a4E568B54981E3C' as const;

// Network configuration
export const GNOSIS_RPC_URL = 'https://rpc.gnosischain.com/' as const;
export const SAFE_TRANSACTION_SERVICE_URL = 'https://safe-transaction-gnosis-chain.safe.global/api/v1' as const;

// Default values
export const DEFAULT_SALT = BigInt('110647465789069657756111682142268192901188952877020749627246931254533522453');

// Token decimals (CRC tokens typically use 18 decimals)
export const CRC_DECIMALS = 18;