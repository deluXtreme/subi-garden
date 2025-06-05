import { ethers } from 'ethers';
import { circles } from '$lib/stores/circles';
import { get } from 'svelte/store';
import { GNOSIS_RPC_URL, SUBSCRIPTION_MANAGER, HUB_ADDRESS } from '$lib/constants/contracts';
import type { Address } from '@circles-sdk/utils';

// TODO: Replace these placeholders with actual contract ABIs
const SUBSCRIPTION_MANAGER_ABI = [
  // Paste SubscriptionManager ABI here
  {
    "type": "function",
    "name": "subscribe",
    "inputs": [
      {"name": "recipient", "type": "address"},
      {"name": "amount", "type": "uint256"},
      {"name": "frequency", "type": "uint256"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "modules",
    "inputs": [{"name": "user", "type": "address"}],
    "outputs": [{"name": "module", "type": "address"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerModule",
    "inputs": [
      {"name": "module", "type": "address"},
      {"name": "isEnabled", "type": "bool"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {"name": "module", "type": "address"},
      {"name": "subId", "type": "uint256"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAllModules",
    "inputs": [],
    "outputs": [{"name": "", "type": "address[]"}],
    "stateMutability": "view"
  }
];

const SUBSCRIPTION_MODULE_ABI = [
  // Paste SubscriptionModule ABI here
  {
    "type": "function",
    "name": "subscribe",
    "inputs": [
      {"name": "recipient", "type": "address"},
      {"name": "amount", "type": "uint256"},
      {"name": "frequency", "type": "uint256"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];

const HUB_ABI = [
  // Paste Hub ABI here
  {
    "type": "function",
    "name": "setApprovalForAll",
    "inputs": [
      {"name": "operator", "type": "address"},
      {"name": "approved", "type": "bool"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isApprovedForAll",
    "inputs": [
      {"name": "account", "type": "address"},
      {"name": "operator", "type": "address"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view"
  }
];

// Contract addresses are imported from constants

/**
 * Get signer and provider from Circles SDK
 */
function getCirclesConnection(): { signer: ethers.Signer; provider: ethers.Provider; address: string } {
  const sdk = get(circles);
  
  if (!sdk) {
    throw new Error('Circles SDK not initialized. Please connect your wallet first.');
  }

  if (!sdk.contractRunner) {
    throw new Error('Contract runner not available.');
  }

  if (!sdk.contractRunner.address) {
    throw new Error('Wallet address not available.');
  }

  // The Circles SDK contractRunner should be compatible with ethers
  // It should have signer capabilities for write operations
  const signer = sdk.contractRunner as unknown as ethers.Signer;
  const provider = signer.provider || new ethers.JsonRpcProvider(GNOSIS_RPC_URL);

  return {
    signer,
    provider,
    address: sdk.contractRunner.address
  };
}

/**
 * Get read-only provider for contract calls that don't require signing
 */
function getReadOnlyProvider(): ethers.Provider {
  return new ethers.JsonRpcProvider(GNOSIS_RPC_URL);
}

/**
 * Create a subscription by calling the SubscriptionManager contract
 */
export async function createSubscription(
  recipient: Address,
  amount: string,
  frequencySeconds: number
): Promise<`0x${string}`> {
  try {
    const { signer, address } = getCirclesConnection();
    
    console.log('Creating subscription:', {
      from: address,
      recipient,
      amount: amount.toString(),
      frequency: frequencySeconds.toString()
    });
    
    const amountWei = ethers.parseEther(amount);
    
    // Create contract instance with signer for write operations
    const subscriptionManager = new ethers.Contract(
      SUBSCRIPTION_MANAGER,
      SUBSCRIPTION_MANAGER_ABI,
      signer
    );
    
    // Call subscribe on the SubscriptionManager contract
    const tx = await subscriptionManager.subscribe(recipient, amountWei, BigInt(frequencySeconds));
    console.log('Transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt);
    
    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }
    
    return tx.hash as `0x${string}`;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if user has a subscription module registered
 */
export async function checkUserModule(userAddress: Address): Promise<{
  hasModule: boolean;
  moduleAddress?: Address;
}> {
  try {
    const provider = getReadOnlyProvider();
    
    const subscriptionManager = new ethers.Contract(
      SUBSCRIPTION_MANAGER,
      SUBSCRIPTION_MANAGER_ABI,
      provider
    );
    
    const moduleAddress = await subscriptionManager.modules(userAddress) as Address;
    const hasModule = moduleAddress && moduleAddress !== '0x0000000000000000000000000000000000000000';
    
    return {
      hasModule: !!hasModule,
      moduleAddress: hasModule ? moduleAddress : undefined
    };
  } catch (error) {
    console.error('Error checking module registration:', error);
    return { hasModule: false };
  }
}

/**
 * Set approval for subscription module on Hub contract
 */
export async function approveModuleForHub(moduleAddress: Address): Promise<`0x${string}`> {
  try {
    const { signer } = getCirclesConnection();
    
    const hubContract = new ethers.Contract(
      HUB_ADDRESS,
      HUB_ABI,
      signer
    );
    
    const tx = await hubContract.setApprovalForAll(moduleAddress, true);
    const receipt = await tx.wait();
    
    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }
    
    return tx.hash as `0x${string}`;
  } catch (error) {
    console.error('Error approving module for hub:', error);
    throw new Error(`Failed to approve module: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if module is approved for Hub
 */
export async function isModuleApprovedForHub(
  userAddress: Address, 
  moduleAddress: Address
): Promise<boolean> {
  try {
    const provider = getReadOnlyProvider();
    
    const hubContract = new ethers.Contract(
      HUB_ADDRESS,
      HUB_ABI,
      provider
    );
    
    const isApproved = await hubContract.isApprovedForAll(userAddress, moduleAddress) as boolean;
    return isApproved;
  } catch (error) {
    console.error('Error checking module approval:', error);
    return false;
  }
}

/**
 * Register a module with the subscription manager
 */
export async function registerModule(
  moduleAddress: Address, 
  isEnabled: boolean = true
): Promise<`0x${string}`> {
  try {
    const { signer } = getCirclesConnection();
    
    const subscriptionManager = new ethers.Contract(
      SUBSCRIPTION_MANAGER,
      SUBSCRIPTION_MANAGER_ABI,
      signer
    );
    
    const tx = await subscriptionManager.registerModule(moduleAddress, isEnabled);
    const receipt = await tx.wait();
    
    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }
    
    return tx.hash as `0x${string}`;
  } catch (error) {
    console.error('Error registering module:', error);
    throw new Error(`Failed to register module: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  moduleAddress: Address,
  subscriptionId: bigint
): Promise<`0x${string}`> {
  try {
    const { signer } = getCirclesConnection();
    
    const subscriptionManager = new ethers.Contract(
      SUBSCRIPTION_MANAGER,
      SUBSCRIPTION_MANAGER_ABI,
      signer
    );
    
    const tx = await subscriptionManager.cancel(moduleAddress, subscriptionId);
    const receipt = await tx.wait();
    
    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }
    
    return tx.hash as `0x${string}`;
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all registered modules
 */
export async function getAllModules(): Promise<Address[]> {
  try {
    const provider = getReadOnlyProvider();
    
    const subscriptionManager = new ethers.Contract(
      SUBSCRIPTION_MANAGER,
      SUBSCRIPTION_MANAGER_ABI,
      provider
    );
    
    const modules = await subscriptionManager.getAllModules() as Address[];
    return modules;
  } catch (error) {
    console.error('Error getting all modules:', error);
    return [];
  }
}

/**
 * Execute a raw transaction with given data
 * Useful for module installation and other complex operations
 */
export async function executeTransaction(
  to: string,
  value: string,
  data: string
): Promise<`0x${string}`> {
  try {
    const { signer } = getCirclesConnection();
    
    const tx = await signer.sendTransaction({
      to,
      value,
      data,
    });
    
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    
    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }
    
    return tx.hash as `0x${string}`;
  } catch (error) {
    console.error('Error executing transaction:', error);
    throw new Error(`Failed to execute transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute multiple transactions sequentially
 */
export async function executeTransactionBatch(
  transactions: Array<{ to: string; value: string; data: string }>
): Promise<`0x${string}`[]> {
  const txHashes: `0x${string}`[] = [];
  
  for (const transaction of transactions) {
    const hash = await executeTransaction(transaction.to, transaction.value, transaction.data);
    txHashes.push(hash);
  }
  
  return txHashes;
}

/**
 * Format contract errors for user display
 */
export function formatContractError(error: any): string {
  // Handle ethers specific errors
  if (error?.reason) {
    return error.reason;
  }
  
  if (error?.data?.message) {
    return error.data.message;
  }
  
  if (error?.message) {
    // Extract useful parts from common error messages
    if (error.message.includes('user rejected') || error.message.includes('User rejected')) {
      return 'Transaction was rejected by user';
    }
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    }
    if (error.message.includes('execution reverted')) {
      return 'Transaction failed - contract execution reverted';
    }
    if (error.message.includes('CALL_EXCEPTION')) {
      return 'Contract call failed - please check your parameters';
    }
    if (error.message.includes('Circles SDK not initialized')) {
      return 'Wallet not connected. Please connect your wallet first.';
    }
  }
  
  return 'Transaction failed. Please try again.';
}

/**
 * Helper to convert frequency to human readable format
 */
export function formatFrequency(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) !== 1 ? 's' : ''}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) !== 1 ? 's' : ''}`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) !== 1 ? 's' : ''}`;
  return `${Math.floor(seconds / 2592000)} month${Math.floor(seconds / 2592000) !== 1 ? 's' : ''}`;
}