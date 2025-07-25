import { ethers } from 'ethers';
import { circles } from '$lib/stores/circles';
import { get } from 'svelte/store';
import {
  GNOSIS_RPC_URL,
  SUBSCRIPTION_MODULE,
  HUB_ADDRESS,
} from '$lib/constants/contracts';
import { SubscriptionCategory } from '$lib/types/subscriptions';
import type { Address } from '@circles-sdk/utils';
import type { ProcessedSubscription } from '$lib/types/subscriptions';

// Updated SubscriptionModule ABI for new contract interface
//
const SUBSCRIPTION_MODULE_ABI = [
  {
    type: 'function',
    name: 'subscribe',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'frequency', type: 'uint256' },
      { name: 'category', type: 'uint8' },
    ],
    outputs: [{ name: 'id', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unsubscribe',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getSubscription',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'subscriber', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'lastRedeemed', type: 'uint256' },
          { name: 'frequency', type: 'uint256' },
          { name: 'category', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubscriptionIds',
    inputs: [{ name: 'subscriber', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'unsubscribe',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateRecipient',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'newRecipient', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isValidOrRedeemable',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'SubscriptionCreated',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'nextRedeemAt', type: 'uint256', indexed: false },
      { name: 'category', type: 'uint8', indexed: false },
    ],
  },
];

const HUB_ABI = [
  // Paste Hub ABI here
  {
    type: 'function',
    name: 'setApprovalForAll',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isApprovedForAll',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
];

// Contract addresses are imported from constants
// Note: Architecture has changed - we now interact directly with SubscriptionModule instances

/**
 * Get signer and provider from Circles SDK
 */
export function getCirclesConnection(): {
  signer: ethers.Signer;
  provider: ethers.Provider;
  address: string;
} {
  const sdk = get(circles);

  if (!sdk) {
    throw new Error(
      'Circles SDK not initialized. Please connect your wallet first.'
    );
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
  const provider =
    signer.provider || new ethers.JsonRpcProvider(GNOSIS_RPC_URL);

  return {
    signer,
    provider,
    address: sdk.contractRunner.address,
  };
}

/**
 * Get read-only provider for contract calls that don't require signing
 */
function getReadOnlyProvider(): ethers.Provider {
  return new ethers.JsonRpcProvider(GNOSIS_RPC_URL);
}

/**
 * Get a user's subscription ids
 */
export async function getUserSubscriptionIds(
  user: Address,
  moduleAddress: Address
): Promise<string[]> {
  try {
    const provider = getReadOnlyProvider();
    const contractAddress = moduleAddress || SUBSCRIPTION_MODULE;

    const subscriptionModule = new ethers.Contract(
      contractAddress,
      SUBSCRIPTION_MODULE_ABI,
      provider
    );

    // This is a view function, not a transaction
    const ids = await subscriptionModule.getSubscriptionIds(user);
    console.log('Got subscription ids for user:', user, ids);
    return ids;
  } catch (error) {
    console.error('Failed to get subscription IDs:', error);
    throw error;
  }
}

export async function getUserSubscriptions(
  user: Address,
  moduleAddress: Address
): Promise<ProcessedSubscription[]> {
  try {
    // First get all subscription IDs for this user
    const subscriptionIds = await getUserSubscriptionIds(user, moduleAddress);
    console.log(
      'Successfully got subscription ids for user:',
      user,
      subscriptionIds
    );
    if (!subscriptionIds || subscriptionIds.length === 0) {
      return [];
    }

    // Fetch details for each subscription
    // Fetch details for each subscription
    const subscriptions = await Promise.all(
      subscriptionIds.map(async (id, index) => {
        try {
          const sub = await getSubscription(id as `0x${string}`, moduleAddress);
          console.log('Returned subscription: ', sub);
          return {
            contract_address:
              sub.module || moduleAddress || SUBSCRIPTION_MODULE,
            sub_id: id,
            module: sub.module || moduleAddress || SUBSCRIPTION_MODULE,
            subscriber: sub.subscriber,
            recipient: sub.recipient,
            amount: sub.amount.toString(),
            frequency: Number(sub.frequency),
            category: Number(sub.category) as SubscriptionCategory,
            tx_hash:
              '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
            block_number: 0, // Placeholder
            block_hash:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            network: 'gnosis',
            formattedAmount: formatAmount(sub.amount.toString()),
            formattedFrequency: formatFrequency(Number(sub.frequency)),
            formattedCategory: formatCategory(Number(sub.category)),
            // EventRow properties - using index to ensure uniqueness
            blockNumber: index,
            transactionIndex: 0,
            logIndex: 0,
            transactionHash:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            address: sub.module || moduleAddress || SUBSCRIPTION_MODULE,
            topics: [],
            data: '',
            removed: false,
          } as ProcessedSubscription;
        } catch (error) {
          console.error(`Failed to fetch subscription ${id}:`, error);
          return null;
        }
      })
    );

    // Filter out any failed fetches
    return subscriptions.filter(
      (sub): sub is ProcessedSubscription => sub !== null
    );
  } catch (error) {
    console.error('Failed to get user subscriptions:', error);
    throw error;
  }
}

function formatAmount(amount: string): string {
  // Convert from wei to CRC (assuming 18 decimals)
  const num = parseFloat(amount) / 10 ** 18;
  return num.toFixed(2);
}

/**
 * Create a subscription by calling the SubscriptionModule contract
 */
export async function createSubscription(
  recipient: Address,
  amount: string,
  frequencySeconds: number,
  category: SubscriptionCategory,
  moduleAddress?: Address
): Promise<{ txHash: `0x${string}`; subscriptionId: string }> {
  try {
    const { signer, address } = getCirclesConnection();

    // Use the single SUBSCRIPTION_MODULE address unless a specific module address is provided
    const contractAddress = moduleAddress || SUBSCRIPTION_MODULE;

    console.log('Creating subscription:', {
      from: address,
      recipient,
      amount: amount.toString(),
      frequency: frequencySeconds.toString(),
      category: category.toString(),
      contractAddress,
    });

    const amountWei = ethers.parseEther(amount);

    // Create contract instance with signer for write operations
    const subscriptionModule = new ethers.Contract(
      contractAddress,
      SUBSCRIPTION_MODULE_ABI,
      signer
    );

    // Call subscribe on the SubscriptionModule contract with category parameter
    const tx = await subscriptionModule.subscribe(
      recipient,
      amountWei,
      BigInt(frequencySeconds),
      category
    );
    console.log('Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt);

    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    // Extract subscription ID from transaction logs
    let subscriptionId = '';
    if (receipt.logs && receipt.logs.length > 0) {
      try {
        const iface = new ethers.Interface(SUBSCRIPTION_MODULE_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && parsed.name === 'SubscriptionCreated') {
              subscriptionId = parsed.args.id;
              break;
            }
          } catch (e) {
            // Continue to next log if parsing fails
          }
        }
      } catch (e) {
        console.warn('Could not parse subscription ID from logs:', e);
      }
    }

    return {
      txHash: tx.hash as `0x${string}`,
      subscriptionId: subscriptionId || 'unknown',
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw new Error(
      `Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get subscription by ID from the SubscriptionModule
 */
export async function getSubscription(
  subscriptionId: string,
  moduleAddress?: Address
): Promise<any> {
  try {
    const provider = getReadOnlyProvider();
    // Use the single SUBSCRIPTION_MODULE address unless a specific module address is provided
    const contractAddress = moduleAddress || SUBSCRIPTION_MODULE;

    const subscriptionModule = new ethers.Contract(
      contractAddress,
      SUBSCRIPTION_MODULE_ABI,
      provider
    );

    return await subscriptionModule.getSubscription(subscriptionId);
  } catch (error) {
    console.error('Error getting subscription:', error);
    throw new Error(
      `Failed to get subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all subscription IDs for a subscriber
 */
export async function getSubscriptionIds(
  subscriberAddress: Address,
  moduleAddress?: Address
): Promise<string[]> {
  try {
    const provider = getReadOnlyProvider();
    // Use the single SUBSCRIPTION_MODULE address unless a specific module address is provided
    const contractAddress = moduleAddress || SUBSCRIPTION_MODULE;

    const subscriptionModule = new ethers.Contract(
      contractAddress,
      SUBSCRIPTION_MODULE_ABI,
      provider
    );

    return await subscriptionModule.getSubscriptionIds(subscriberAddress);
  } catch (error) {
    console.error('Error getting subscription IDs:', error);
    return [];
  }
}

/**
 * Check if user has the subscription module enabled on their Safe
 */
export async function checkUserModule(
  userAddress: Address,
  module: Address
): Promise<{
  hasModule: boolean;
  moduleAddress?: Address;
}> {
  try {
    const provider = getReadOnlyProvider();

    // Create Safe contract instance to check if module is enabled
    const safeContract = new ethers.Contract(
      userAddress,
      [
        {
          type: 'function',
          name: 'isModuleEnabled',
          inputs: [{ name: 'module', type: 'address' }],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'view',
        },
      ],
      provider
    );

    // Check if SUBSCRIPTION_MODULE is enabled on this Safe
    const isEnabled = (await safeContract.isModuleEnabled(module)) as boolean;

    return {
      hasModule: isEnabled,
      moduleAddress: isEnabled ? module : undefined,
    };
  } catch (error) {
    console.error('Error checking module installation:', error);
    return { hasModule: false };
  }
}

/**
 * Set approval for subscription module on Hub contract
 */
export async function approveModuleForHub(
  moduleAddress: Address
): Promise<`0x${string}`> {
  try {
    const { signer } = getCirclesConnection();

    const hubContract = new ethers.Contract(HUB_ADDRESS, HUB_ABI, signer);

    const tx = await hubContract.setApprovalForAll(moduleAddress, true);
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    return tx.hash as `0x${string}`;
  } catch (error) {
    console.error('Error approving module for hub:', error);
    throw new Error(
      `Failed to approve module: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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

    const hubContract = new ethers.Contract(HUB_ADDRESS, HUB_ABI, provider);

    const isApproved = (await hubContract.isApprovedForAll(
      userAddress,
      moduleAddress
    )) as boolean;
    return isApproved;
  } catch (error) {
    console.error('Error checking module approval:', error);
    return false;
  }
}

/**
 * Cancel a subscription (unsubscribe)
 */
export async function unsubscribe(
  subscriptionId: string,
  moduleAddress?: Address
): Promise<`0x${string}`> {
  try {
    // Use the single SUBSCRIPTION_MODULE address unless a specific module address is provided
    const { signer, address } = getCirclesConnection();
    const contractAddress = moduleAddress || SUBSCRIPTION_MODULE;

    const subscriptionModule = new ethers.Contract(
      contractAddress,
      SUBSCRIPTION_MODULE_ABI,
      signer
    );

    const tx = await subscriptionModule.unsubscribe(subscriptionId);
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    return tx.hash as `0x${string}`;
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw new Error(
      `Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Redeem a subscription payment
 */
export async function redeemSubscription(
  subscriptionId: string,
  data: string = '0x',
  moduleAddress?: Address
): Promise<`0x${string}`> {
  try {
    const { signer, address } = getCirclesConnection();
    const contractAddress = moduleAddress || SUBSCRIPTION_MODULE;

    const subscriptionModule = new ethers.Contract(
      contractAddress,
      SUBSCRIPTION_MODULE_ABI,
      signer
    );

    const tx = await subscriptionModule.redeem(subscriptionId, data);
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    return tx.hash as `0x${string}`;
  } catch (error) {
    console.error('Error redeeming subscription:', error);
    throw new Error(
      `Failed to redeem subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
    throw new Error(
      `Failed to execute transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
    const hash = await executeTransaction(
      transaction.to,
      transaction.value,
      transaction.data
    );
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
    if (
      error.message.includes('user rejected') ||
      error.message.includes('User rejected')
    ) {
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
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) !== 1 ? 's' : ''}`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) !== 1 ? 's' : ''}`;
  if (seconds < 2592000)
    return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) !== 1 ? 's' : ''}`;
  return `${Math.floor(seconds / 2592000)} month${Math.floor(seconds / 2592000) !== 1 ? 's' : ''}`;
}

/**
 * Helper to convert category to human readable format
 */
export function formatCategory(category: SubscriptionCategory): string {
  switch (category) {
    case SubscriptionCategory.TRUSTED:
      return 'Trusted';
    case SubscriptionCategory.UNTRUSTED:
      return 'Direct';
    case SubscriptionCategory.GROUP:
      return 'Group';
    default:
      return 'Unknown';
  }
}
