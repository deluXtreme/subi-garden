import type { Address } from '@circles-sdk/utils';
import {
  HUB_ADDRESS,
  MODULE_PROXY_FACTORY,
  SUBSCRIPTION_MANAGER,
  SUBSCRIPTION_MASTER_COPY,
  DEFAULT_SALT,
  GNOSIS_RPC_URL,
  SAFE_TRANSACTION_SERVICE_URL
} from '$lib/constants/contracts';
import {
  createSubscription,
  checkUserModule,
  approveModuleForHub,
  registerModule,
  executeTransactionBatch,
  formatContractError
} from './contractUtils';
import { ethers } from 'ethers';

export interface SubscriptionParams {
  subscriber: string;
  recipient: string;
  amount: number;
  frequency: number;
  tokenAddress: string;
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
export async function prepareModuleInstallation(safeAddress: string): Promise<ModuleInstallationResult> {
  const { hasModule, moduleAddress } = await checkModuleInstalled(safeAddress);
  
  if (hasModule) {
    return {
      needsModuleInstall: false,
      moduleAddress
    };
  }

  try {
    const transactions = await prepareEnableModuleTransactions(
      safeAddress as Address,
      SUBSCRIPTION_MANAGER,
      DEFAULT_SALT
    );

    return {
      needsModuleInstall: true,
      transactions
    };
  } catch (error) {
    console.error('Error preparing module installation:', error);
    throw new Error(`Failed to prepare module installation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a subscription using wagmi core
 */
export async function createSubscriptionFlow(params: SubscriptionParams): Promise<string> {
  const { subscriber, recipient, amount, frequency } = params;
  
  // First check if module is installed
  const moduleCheck = await prepareModuleInstallation(subscriber);
  
  if (moduleCheck.needsModuleInstall && moduleCheck.transactions) {
    // If module needs to be installed, execute those transactions first
    await executeModuleInstallation(moduleCheck.transactions);
    
    // Wait a bit for installation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  try {
    console.log('Creating subscription:', {
      recipient,
      amount: amount.toString(),
      frequency: BigInt(frequency).toString()
    });
    
    const txHash = await createSubscription(
      recipient as Address,
      amount.toString(),
      frequency
    );
    
    console.log('Subscription created successfully, tx hash:', txHash);
    return txHash;
  } catch (error) {
    console.error('Error creating subscription:', error);
    const formattedError = formatContractError(error);
    throw new Error(`Failed to create subscription: ${formattedError}`);
  }
}



/**
 * Execute module installation transactions
 */
async function executeModuleInstallation(transactions: MetaTransactionData[]): Promise<void> {
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

// Module preparation functions adapted from subscribeTx.tsx
export async function prepareEnableModuleTransactions(
  safeAddress: Address,
  managerAddress: Address = SUBSCRIPTION_MANAGER,
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
  const registerModuleTx = buildRegisterManagerTx(moduleProxyAddress, managerAddress);
  const moduleApprovalTx = buildModuleApprovalTx(HUB_ADDRESS, moduleProxyAddress);

  return [
    ...(isDeployed ? [] : [deployModuleTx]),
    ...(isInstalled ? [] : [enableModuleTx]),
    registerModuleTx,
    moduleApprovalTx,
  ];
}

async function buildModuleDeploymentTx(
  safeAddress: Address,
  salt: bigint = DEFAULT_SALT
): Promise<{ tx: MetaTransactionData; predictedAddress: Address }> {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const initParams = abiCoder.encode(
    ['address', 'address', 'address'],
    [safeAddress, safeAddress, safeAddress]
  );

  const setupInterface = new ethers.Interface(['function setUp(bytes memory initParams)']);
  const initData = setupInterface.encodeFunctionData('setUp', [initParams]);

  const deployInterface = new ethers.Interface([
    'function deployModule(address masterCopy,bytes memory initializer, uint256 saltNonce) public returns (address proxy)',
  ]);
  const deployData = deployInterface.encodeFunctionData('deployModule', [
    SUBSCRIPTION_MASTER_COPY,
    initData,
    salt,
  ]);

  const predictedAddress = await predictMinimalProxyAddress({
    factory: MODULE_PROXY_FACTORY,
    masterCopy: SUBSCRIPTION_MASTER_COPY,
    initializer: initData,
    saltNonce: salt,
  });

  return {
    tx: {
      to: MODULE_PROXY_FACTORY.toString(),
      value: '0',
      data: deployData,
    },
    predictedAddress,
  };
}

function buildEnableModuleTx(
  safeAddress: Address,
  moduleAddress: Address
): MetaTransactionData {
  const enableInterface = new ethers.Interface(['function enableModule(address module)']);
  const enableModuleData = enableInterface.encodeFunctionData('enableModule', [moduleAddress]);

  return {
    to: safeAddress,
    value: '0',
    data: enableModuleData,
  };
}

function buildRegisterManagerTx(
  moduleAddress: Address,
  managerAddress: Address
): MetaTransactionData {
  const registerInterface = new ethers.Interface(['function registerModule(address module, bool isEnabled)']);
  const registerModuleData = registerInterface.encodeFunctionData('registerModule', [moduleAddress, true]);

  return {
    to: managerAddress,
    value: '0',
    data: registerModuleData,
  };
}

function buildModuleApprovalTx(
  hubAddress: Address,
  moduleProxyAddress: Address
): MetaTransactionData {
  const approvalInterface = new ethers.Interface([
    'function setApprovalForAll(address operator, bool approved)',
  ]);
  const approvalData = approvalInterface.encodeFunctionData('setApprovalForAll', [moduleProxyAddress, true]);

  return {
    to: hubAddress,
    value: '0',
    data: approvalData,
  };
}

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
    abiCoder.encode(['bytes32', 'uint256'], [initializerHash, BigInt(saltNonce)])
  );

  const prefix = '0x602d8060093d393df3363d3d373d3d3d363d73';
  const suffix = '0x5af43d82803e903d91602b57fd5bf3';

  const initCode = ethers.concat([prefix, masterCopy, suffix]);
  const bytecodeHash = ethers.keccak256(initCode);

  const predictedAddress = ethers.getCreate2Address(factory, salt, bytecodeHash);

  return predictedAddress as Address;
}

async function getSafesForModule(moduleAddress: string): Promise<Address[]> {
  const url = `${SAFE_TRANSACTION_SERVICE_URL}/modules/${moduleAddress}/safes/`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch safes for module ${moduleAddress}: ${response.statusText}`);
    }

    const data: { safes: string[] } = await response.json();
    return data.safes.map((x) => ethers.getAddress(x) as Address);
  } catch (error) {
    console.error('Error fetching safes for module:', error);
    return [];
  }
}