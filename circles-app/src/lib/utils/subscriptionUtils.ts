import type { Address } from '@circles-sdk/utils';
import {
  HUB_ADDRESS,
  SUBSCRIPTION_MODULE,
  DEFAULT_SALT,
  GNOSIS_RPC_URL,
} from '$lib/constants/contracts';
import {
  createSubscription,
  checkUserModule,
  executeTransactionBatch,
  formatContractError,
  getCirclesConnection,
} from './contractUtils';
import {
  SubscriptionCategory,
  type SubscriptionResult,
} from '$lib/types/subscriptions';
import {
  sendCalls,
  createSubscriptionBatchCalls,
  formatBatchCallError,
} from './sendCalls';
import { ethers } from 'ethers';

export interface SubscriptionParams {
  subscriber: string;
  recipient: string;
  amount: number;
  frequency: number;
  tokenAddress: string;
  category: SubscriptionCategory;
}

export interface ModuleInstallationResult {
  needsModuleInstall: boolean;
  transactions?: MetaTransactionData[];
  moduleAddress?: string;
}

export interface MetaTransactionData {
  to: string;
  value: string;
  data: string;
}

/**
 * Check if user has a subscription module installed
 */
export async function checkModuleInstalled(
  userAddress: string,
  module: Address
): Promise<{
  hasModule: boolean;
  moduleAddress?: string;
}> {
  try {
    return await checkUserModule(userAddress as Address, module);
  } catch (error) {
    console.error('Error checking module installation:', error);
    return { hasModule: false };
  }
}

/**
 * Prepare module installation transactions if needed
 */
export async function prepareModuleInstallation(
  safeAddress: string
): Promise<ModuleInstallationResult> {
  const { hasModule } = await checkModuleInstalled(
    safeAddress,
    SUBSCRIPTION_MODULE
  );

  if (hasModule) {
    return {
      needsModuleInstall: false,
    };
  }

  try {
    // In the new architecture, we only need to enable the SUBSCRIPTION_MODULE
    const enableModuleTx = buildEnableModuleTx(
      safeAddress as Address,
      SUBSCRIPTION_MODULE
    );

    return {
      needsModuleInstall: true,
      transactions: [enableModuleTx],
    };
  } catch (error) {
    console.error('Error preparing module installation:', error);
    throw new Error(
      `Failed to prepare module installation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a subscription using the new SubscriptionModule interface
 * Uses batched transactions when module is not enabled for better UX
 */
export async function createSubscriptionFlow(
  params: SubscriptionParams
): Promise<SubscriptionResult> {
  console.log('subscription request', params);
  const { subscriber, recipient, amount, frequency, category } = params;

  // First check if module is installed
  const moduleCheck = await prepareModuleInstallation(subscriber);

  if (moduleCheck.needsModuleInstall) {
    // Module needs to be enabled - use batched transactions for better UX
    console.log('Module not enabled, using batched transactions...');

    try {
      const { signer, address } = getCirclesConnection();

      // Create batched calls: enable module + create subscription
      const batchCalls = await createSubscriptionBatchCalls({
        signer,
        safeAddress: subscriber,
        moduleAddress: SUBSCRIPTION_MODULE,
        subscriptionModuleAddress: SUBSCRIPTION_MODULE,
        recipient,
        amount: ethers.parseEther(amount.toString()),
        frequency: BigInt(frequency),
        category,
      });

      console.log('Sending batched calls:', batchCalls);

      // Send batched transaction
      const batchResult = await sendCalls({
        signer,
        account: address,
        calls: batchCalls,
        experimentalFallback: true, // Allow fallback to individual transactions
        forceAtomic: false, // Don't require atomic execution for better compatibility
      });

      console.log('Batch transaction result:', batchResult);

      // For batched calls, we need to extract the subscription ID differently
      // Since we can't easily get the return value from batched calls,
      // we'll return a success result with the batch ID
      return {
        txHash: batchResult.id as `0x${string}`,
        subscriptionId: 'batched', // Will need to be queried separately
      };
    } catch (batchError) {
      console.error('Batch transaction failed:', batchError);
      const formattedError = formatBatchCallError(batchError);
      throw new Error(`Failed to create subscription: ${formattedError}`);
    }
  }

  // Module already enabled - use single transaction
  try {
    console.log('Module already enabled, creating subscription:', {
      recipient,
      amount: amount.toString(),
      frequency: BigInt(frequency).toString(),
      category,
    });

    const result = await createSubscription(
      recipient as Address,
      amount.toString(),
      frequency,
      category
    );

    console.log('Subscription created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error creating subscription:', error);
    const formattedError = formatContractError(error);
    throw new Error(`Failed to create subscription: ${formattedError}`);
  }
}

/**
 * Simpler batched subscription creation using Safe's execTransaction
 * This bypasses the need for wallet_sendCalls by using Safe's batch execution
 */
export async function createSubscriptionFlowBatched(
  params: SubscriptionParams
): Promise<SubscriptionResult> {
  const { subscriber, recipient, amount, frequency, category } = params;

  // First check if module is installed
  const moduleCheck = await prepareModuleInstallation(subscriber);

  if (moduleCheck.needsModuleInstall) {
    // Module needs to be enabled - create a batched Safe transaction
    console.log('Module not enabled, creating batched Safe transaction...');

    try {
      const { signer } = getCirclesConnection();

      // Use batched calls for single signature UX
      const batchCalls = await createSubscriptionBatchCalls({
        signer,
        safeAddress: subscriber,
        moduleAddress: SUBSCRIPTION_MODULE,
        subscriptionModuleAddress: SUBSCRIPTION_MODULE,
        recipient,
        amount: ethers.parseEther(amount.toString()),
        frequency: BigInt(frequency),
        category,
      });

      console.log(
        'Sending batched calls (enable module + subscribe):',
        batchCalls
      );

      // Send batched transaction - user signs ONCE for both operations
      const batchResult = await sendCalls({
        signer,
        calls: batchCalls,
        experimentalFallback: true, // Allow fallback to individual transactions if needed
        forceAtomic: false, // Don't require atomic execution for better compatibility
      });

      console.log('Batched transaction completed:', batchResult);

      // For batched calls, we return the batch ID as the transaction hash
      // The subscription ID would need to be queried separately from events
      return {
        txHash: batchResult.id as `0x${string}`,
        subscriptionId: 'batched-call', // Will need to be queried from events
      };
    } catch (error) {
      console.error('Batched subscription creation failed:', error);
      const formattedError = formatContractError(error);
      throw new Error(`Failed to create subscription: ${formattedError}`);
    }
  }

  // Module already enabled - use single transaction
  console.log('Module already enabled, creating subscription directly...');
  return await createSubscription(
    recipient as Address,
    amount.toString(),
    frequency,
    category
  );
}

function buildEnableModuleTx(
  safeAddress: Address,
  moduleAddress: Address
): MetaTransactionData {
  const enableInterface = new ethers.Interface([
    'function enableModule(address module)',
  ]);
  const enableModuleData = enableInterface.encodeFunctionData('enableModule', [
    moduleAddress,
  ]);

  return {
    to: safeAddress,
    value: '0',
    data: enableModuleData,
  };
}
