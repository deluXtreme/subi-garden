import { ethers } from 'ethers';

/* ---------- Types ------------------------------------------------------- */

export interface SingleCall {
  to: string;
  /** Raw encoded calldata OR supply (abi,functionName,args) instead */
  data?: string;
  value?: bigint | string | number;
  abi?: ethers.InterfaceAbi;
  functionName?: string;
  args?: readonly unknown[];
  /** Optional "domain tag" suffix */
  dataSuffix?: string;
}

export interface SendCallsOptions {
  signer: ethers.Signer; // Connected signer
  calls: readonly SingleCall[]; // The batch
  chainId?: number; // Defaults to signer.getChainId()
  account?: string; // Defaults to signer.getAddress()
  capabilities?: Record<string, any>; // EIP‑5792 capabilities blob
  forceAtomic?: boolean; // Require atomic execution
  experimentalFallback?: boolean; // Turn on sequential fallback
  experimentalFallbackDelay?: number; // ms between fallback txs (default 32)
  id?: string; // Custom bundle id
  version?: string; // EIP‑5792 version (default "2.0.0")
}

export interface SendCallsResult {
  id: string;
  capabilities?: any;
  txHashes?: string[]; // For fallback mode, we track individual tx hashes
}

/* ---------- Constants (mirrors viem) ----------------------------------- */

const FALLBACK_MAGIC =
  '0x5792579257925792579257925792579257925792579257925792579257925792';
const FALLBACK_TX_ERROR_PAD = ethers.zeroPadValue('0x00', 32);

/* ---------- Main function ---------------------------------------------- */

export async function sendCalls(
  opts: SendCallsOptions
): Promise<SendCallsResult> {
  const {
    signer,
    calls,
    chainId,
    account,
    capabilities,
    forceAtomic = false,
    experimentalFallback = true, // Default to true for better UX
    experimentalFallbackDelay = 100, // Slightly higher delay for safety
    id,
    version = '2.0.0',
  } = opts;

  const provider = signer.provider;
  if (!provider) throw new Error('Signer must be connected to a provider');

  // Get chainId and account if not provided
  const resolvedChainId =
    chainId ??
    (await signer.provider!.getNetwork().then((n) => Number(n.chainId)));
  const resolvedAccount = account ?? (await signer.getAddress());

  if (!resolvedChainId) {
    throw new Error('Could not determine chain ID');
  }

  /* ---- normalise & encode each call ---- */
  const formatted = calls.map((c) => {
    let data = c.data;
    if (!data && c.abi && c.functionName) {
      const iface = new ethers.Interface(c.abi);
      data = iface.encodeFunctionData(c.functionName, c.args ?? []);
    }
    if (c.dataSuffix && data) {
      data = ethers.concat([data, c.dataSuffix]);
    }
    return {
      to: c.to,
      data,
      value: c.value != null ? ethers.toBeHex(c.value) : undefined,
    };
  });

  /* ---- attempt native wallet_sendCalls ---- */
  const params = [
    {
      from: resolvedAccount,
      chainId: ethers.toBeHex(resolvedChainId),
      calls: formatted,
      capabilities,
      atomicRequired: forceAtomic,
      id,
      version,
    },
  ];

  try {
    console.log('Attempting wallet_sendCalls with params:', params);
    const result: any = await (provider as any).send(
      'wallet_sendCalls',
      params
    );
    console.log('wallet_sendCalls succeeded:', result);
    return typeof result === 'string' ? { id: result } : result;
  } catch (err: any) {
    console.log('wallet_sendCalls failed, error:', err.message);

    /* ---- optional fallback path (eth_sendTransaction loop) ---- */
    if (!experimentalFallback) {
      throw new Error(`wallet_sendCalls not supported: ${err.message}`);
    }

    console.log('Falling back to individual transactions...');

    // Reject if non‑optional capabilities or atomicity can't be honoured
    if (
      capabilities &&
      Object.values(capabilities).some((c: any) => !c?.optional)
    ) {
      throw new Error(
        'Non‑optional capabilities not supported when falling back to eth_sendTransaction'
      );
    }
    if (forceAtomic && formatted.length > 1) {
      throw new Error(
        'forceAtomic=true cannot be satisfied when falling back to eth_sendTransaction'
      );
    }

    const hashes: string[] = [];
    const txHashes: string[] = [];

    for (let i = 0; i < formatted.length; i++) {
      const call = formatted[i];
      try {
        console.log(`Sending transaction ${i + 1}/${formatted.length}:`, call);
        const tx = await signer.sendTransaction({
          to: call.to,
          data: call.data,
          value: call.value ? BigInt(call.value) : undefined,
        });

        console.log(`Transaction ${i + 1} sent:`, tx.hash);
        hashes.push(ethers.zeroPadValue(tx.hash, 32));
        txHashes.push(tx.hash);

        // Wait for transaction to be mined before proceeding to next
        if (i < formatted.length - 1) {
          console.log(`Waiting for transaction ${i + 1} to be mined...`);
          await tx.wait();
        }
      } catch (txErr: any) {
        console.error(`Transaction ${i + 1} failed:`, txErr);
        hashes.push(FALLBACK_TX_ERROR_PAD);
        throw new Error(`Transaction ${i + 1} failed: ${txErr.message}`);
      }

      if (experimentalFallbackDelay > 0 && i < formatted.length - 1) {
        await new Promise((r) => setTimeout(r, experimentalFallbackDelay));
      }
    }

    const bundleId = ethers.concat([
      ...hashes,
      ethers.zeroPadValue(ethers.toBeHex(resolvedChainId!), 32),
      FALLBACK_MAGIC,
    ]);

    console.log('All transactions completed successfully');
    return {
      id: bundleId,
      txHashes,
    };
  }
}

/* ---------- Helper for subscription use case --------------------------- */

export interface SubscriptionBatchCallsOptions {
  signer: ethers.Signer;
  safeAddress: string;
  moduleAddress: string;
  subscriptionModuleAddress: string;
  recipient: string;
  amount: bigint;
  frequency: bigint;
  category: number;
}

/**
 * Create batched calls for enable module + create subscription
 */
export async function createSubscriptionBatchCalls(
  opts: SubscriptionBatchCallsOptions
): Promise<SingleCall[]> {
  const {
    safeAddress,
    moduleAddress,
    subscriptionModuleAddress,
    recipient,
    amount,
    frequency,
    category,
  } = opts;

  // 1. Enable module transaction
  const enableModuleCall: SingleCall = {
    to: safeAddress,
    abi: [
      {
        type: 'function',
        name: 'enableModule',
        inputs: [{ name: 'module', type: 'address' }],
      },
    ],
    functionName: 'enableModule',
    args: [moduleAddress],
  };

  // 2. Create subscription transaction
  const subscriptionCall: SingleCall = {
    to: subscriptionModuleAddress,
    abi: [
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
    ],
    functionName: 'subscribe',
    args: [recipient, amount, frequency, category],
  };

  return [enableModuleCall, subscriptionCall];
}

/* ---------- Utility functions ------------------------------------------ */

/**
 * Check if wallet supports batch calls
 */
export async function checkBatchCallSupport(
  provider: ethers.Provider
): Promise<boolean> {
  try {
    // Try to call wallet_getCapabilities to check if EIP-5792 is supported
    await (provider as any).send('wallet_getCapabilities', []);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format error for user display
 */
export function formatBatchCallError(error: any): string {
  if (error.message?.includes('wallet_sendCalls not supported')) {
    return 'Your wallet does not support batch transactions. Transactions will be sent individually.';
  }
  if (error.message?.includes('User rejected')) {
    return 'Transaction was rejected by user';
  }
  if (error.message?.includes('insufficient funds')) {
    return 'Insufficient funds for transaction';
  }
  return `Transaction failed: ${error.message || 'Unknown error'}`;
}
