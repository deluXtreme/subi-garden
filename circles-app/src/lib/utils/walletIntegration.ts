import { ethers } from 'ethers';
import { avatarState } from '$lib/stores/avatar.svelte';
import { GNOSIS_RPC_URL } from '$lib/constants/contracts';

export interface WalletSigner {
  address: string;
  signer: ethers.Signer;
}

export interface SafeTransactionData {
  to: string;
  value: string;
  data: string;
}

/**
 * Get the current wallet signer
 * TODO: Implement actual wallet connection logic
 */
export async function getWalletSigner(): Promise<WalletSigner> {
  // TODO: Replace with actual wallet integration
  // This could integrate with:
  // - WalletConnect
  // - MetaMask
  // - Safe App SDK
  // - Circles SDK wallet functionality

  throw new Error(
    'Wallet integration not implemented yet. Please implement getWalletSigner()'
  );

  // Example implementation structure:
  // const provider = new ethers.BrowserProvider(window.ethereum);
  // const signer = await provider.getSigner();
  // const address = await signer.getAddress();
  //
  // return {
  //   address,
  //   signer
  // };
}

/**
 * Get the Safe SDK instance for the current user
 * TODO: Implement Safe SDK integration
 */
export async function getSafeSdk() {
  // TODO: Replace with actual Safe SDK integration
  // This would integrate with @safe-global/protocol-kit

  throw new Error(
    'Safe SDK integration not implemented yet. Please implement getSafeSdk()'
  );

  // Example implementation structure:
  // const safeSdk = await Safe.create({
  //   ethAdapter,
  //   safeAddress: avatarState.avatar?.address
  // });
  //
  // return safeSdk;
}

/**
 * Execute a batch of transactions using Safe
 * TODO: Implement batch transaction execution
 */
export async function executeBatchTransactions(
  transactions: SafeTransactionData[]
): Promise<string> {
  // TODO: Replace with actual Safe batch transaction logic
  console.log('Executing batch transactions:', transactions);

  throw new Error(
    'Batch transaction execution not implemented yet. Please implement executeBatchTransactions()'
  );

  // Example implementation structure:
  // const safeSdk = await getSafeSdk();
  // const safeTransaction = await safeSdk.createTransaction({
  //   safeTransactionData: transactions
  // });
  // const txResponse = await safeSdk.executeTransaction(safeTransaction);
  // return txResponse.hash;
}

/**
 * Get the provider for the current network
 */
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(GNOSIS_RPC_URL);
}

/**
 * Get a contract instance with the current signer
 */
export async function getContractWithSigner(
  address: string,
  abi: any[]
): Promise<ethers.Contract> {
  const { signer } = await getWalletSigner();
  return new ethers.Contract(address, abi, signer);
}

/**
 * Get a read-only contract instance
 */
export function getContractReadOnly(
  address: string,
  abi: any[]
): ethers.Contract {
  const provider = getProvider();
  return new ethers.Contract(address, abi, provider);
}

/**
 * Check if the current address matches the connected wallet
 */
export async function validateWalletConnection(): Promise<boolean> {
  try {
    const { address } = await getWalletSigner();
    return address.toLowerCase() === avatarState.avatar?.address.toLowerCase();
  } catch (error) {
    console.error('Error validating wallet connection:', error);
    return false;
  }
}

/**
 * Format transaction error messages for user display
 */
export function formatTransactionError(error: any): string {
  if (error?.reason) {
    return error.reason;
  }

  if (error?.message) {
    // Extract useful parts from common error messages
    if (error.message.includes('user rejected')) {
      return 'Transaction was rejected by user';
    }
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    }
    if (error.message.includes('execution reverted')) {
      return 'Transaction failed - contract execution reverted';
    }
  }

  return 'Transaction failed. Please try again.';
}

/**
 * Get transaction receipt and handle errors
 */
export async function waitForTransaction(
  txHash: string
): Promise<ethers.TransactionReceipt> {
  const provider = getProvider();
  const receipt = await provider.waitForTransaction(txHash);

  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }

  if (receipt.status === 0) {
    throw new Error('Transaction failed');
  }

  return receipt;
}

/**
 * Estimate gas for a transaction
 */
export async function estimateTransactionGas(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[]
): Promise<bigint> {
  try {
    const { signer } = await getWalletSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    return await contract[functionName].estimateGas(...args);
  } catch (error) {
    console.error('Error estimating gas:', error);
    throw error;
  }
}
