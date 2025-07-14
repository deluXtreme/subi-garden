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
export async function checkModuleInstalled(userAddress: string): Promise<{
  hasModule: boolean;
  moduleAddress?: string;
}> {
  try {
    return await checkUserModule(userAddress as Address);
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
  const { hasModule, moduleAddress } = await checkModuleInstalled(safeAddress);

  if (hasModule) {
    return {
      needsModuleInstall: false,
      moduleAddress,
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
  const { subscriber, recipient, amount, frequency, category } = params;

  // First check if module is installed
  const moduleCheck = await prepareModuleInstallation(subscriber);

  if (moduleCheck.needsModuleInstall) {
    // Module needs to be enabled - use batched transactions for better UX
    console.log('Module not enabled, using batched transactions...');

    try {
      const { signer } = getCirclesConnection();

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

      // Create enable module call data
      const enableModuleInterface = new ethers.Interface([
        'function enableModule(address module)',
      ]);
      const enableModuleData = enableModuleInterface.encodeFunctionData(
        'enableModule',
        [SUBSCRIPTION_MODULE]
      );

      // Create subscription call data
      const subscribeInterface = new ethers.Interface([
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
        },
      ]);
      const subscribeData = subscribeInterface.encodeFunctionData('subscribe', [
        recipient,
        ethers.parseEther(amount.toString()),
        BigInt(frequency),
        category,
      ]);

      // Use Safe's MultiSend to batch the transactions
      const MULTISEND_ADDRESS = '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526'; // Gnosis Chain MultiSend

      // Encode the batched transactions
      const enableTxData = ethers.solidityPacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [0, subscriber, 0, enableModuleData.length / 2 - 1, enableModuleData]
      );

      const subscribeTxData = ethers.solidityPacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [0, SUBSCRIPTION_MODULE, 0, subscribeData.length / 2 - 1, subscribeData]
      );

      const batchedTxData = ethers.concat([enableTxData, subscribeTxData]);

      // Create MultiSend call
      const multisendInterface = new ethers.Interface([
        'function multiSend(bytes transactions)',
      ]);
      const multisendData = multisendInterface.encodeFunctionData('multiSend', [
        batchedTxData,
      ]);

      // Execute via Safe's execTransaction
      const safeInterface = new ethers.Interface([
        'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool success)',
      ]);

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

/**
 * Execute module installation transactions
 */
async function executeModuleInstallation(
  transactions: MetaTransactionData[]
): Promise<void> {
  try {
    console.log('Installing subscription module...', transactions);

    // Execute transactions using the new executeTransactionBatch function
    const txHashes = await executeTransactionBatch(transactions);

    console.log('Module installation completed, transaction hashes:', txHashes);
  } catch (error) {
    console.error('Error executing module installation:', error);
    const formattedError = formatContractError(error);
    throw new Error(`Module installation failed: ${formattedError}`);
  }
}

// TODO: No longer needed - replaced by simpler enable module logic
// Module preparation functions adapted from subscribeTx.tsx
export async function prepareEnableModuleTransactions(
  safeAddress: Address,
  moduleAddress: Address = SUBSCRIPTION_MODULE,
  salt: bigint = DEFAULT_SALT
): Promise<MetaTransactionData[]> {
  const { tx: deployModuleTx, predictedAddress: moduleProxyAddress } =
    await buildModuleDeploymentTx(safeAddress, salt);

  const provider = new ethers.JsonRpcProvider(GNOSIS_RPC_URL);

  const [code, installedSafes] = await Promise.all([
    provider.getCode(moduleProxyAddress),
    getSafesForModule(moduleProxyAddress),
  ]);

  const isDeployed = code !== '0x';
  const isInstalled = installedSafes.includes(safeAddress);

  const enableModuleTx = buildEnableModuleTx(safeAddress, moduleProxyAddress);
  const moduleApprovalTx = buildModuleApprovalTx(
    HUB_ADDRESS,
    moduleProxyAddress
  );

  return [
    ...(isDeployed ? [] : [deployModuleTx]),
    ...(isInstalled ? [] : [enableModuleTx]),
    moduleApprovalTx,
  ];
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

// TODO: No longer needed - module approval is handled separately if needed
function buildModuleApprovalTx(
  hubAddress: Address,
  moduleProxyAddress: Address = SUBSCRIPTION_MODULE
): MetaTransactionData {
  const approvalInterface = new ethers.Interface([
    'function setApprovalForAll(address operator, bool approved)',
  ]);
  const approvalData = approvalInterface.encodeFunctionData(
    'setApprovalForAll',
    [moduleProxyAddress, true]
  );

  return {
    to: hubAddress,
    value: '0',
    data: approvalData,
  };
}

// TODO: No longer needed - we now use a single SUBSCRIPTION_MODULE instead of calculating proxy addresses
function predictMinimalProxyAddress({
  factory,
  masterCopy,
  initializer,
  saltNonce,
}: {
  factory: Address;
  masterCopy: Address;
  initializer: string;
  saltNonce: bigint | number;
}): Address {
  const initializerHash = ethers.keccak256(initializer);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const salt = ethers.keccak256(
    abiCoder.encode(
      ['bytes32', 'uint256'],
      [initializerHash, BigInt(saltNonce)]
    )
  );

  const prefix = '0x602d8060093d393df3363d3d373d3d3d363d73';
  const suffix = '0x5af43d82803e903d91602b57fd5bf3';

  const initCode = ethers.concat([prefix, masterCopy, suffix]);
  const bytecodeHash = ethers.keccak256(initCode);

  const predictedAddress = ethers.getCreate2Address(
    factory,
    salt,
    bytecodeHash
  );

  return predictedAddress as Address;
}
