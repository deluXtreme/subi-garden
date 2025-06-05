import { readable } from 'svelte/store';
import Papa from 'papaparse';
import type {
  SubscriptionData,
  ProcessedSubscription,
} from '$lib/types/subscriptions';

// Mock CSV data - in production this would come from your database
const CSV_DATA = `contract_address,sub_id,module,subscriber,recipient,amount,frequency,tx_hash,block_number,block_hash,network
0x7e9baf7cc7cd83bacefb9b2d5c5124c0f9c30834,1,0x39c90767e9fe8f10c3a83b003657ebba7068bbab,0x6b69683c8897e3d18e74b1ba117b49f80423da5d,0xede0c2e70e8e2d54609c1bdf79595506b6f623fe,1000000000000,3600,0x980128d31f18fa103f2ccdaaca3b593c00212c85d14ced222e2ff6da302cb6d5,40355251,0x1e15a44b9b4dfd676eb06d6839519057ebdd8a0d28107de5936dbd7edd36580b,gnosis
0x7e9baf7cc7cd83bacefb9b2d5c5124c0f9c30834,2,0x39c90767e9fe8f10c3a83b003657ebba7068bbab,0x6b69683c8897e3d18e74b1ba117b49f80423da5d,0xede0c2e70e8e2d54609c1bdf79595506b6f623fe,1000000000000,3600,0xfabf9fb993f6a7f2da4ff480044abdebc031ed29319c59374314cf1bbe5596f0,40356998,0x7c84a2f4175499e6a9b31c61a67735ce5ad72fef0d6222c3de12d51f82df706f,gnosis
0x7e9baf7cc7cd83bacefb9b2d5c5124c0f9c30834,3,0x39c90767e9fe8f10c3a83b003657ebba7068bbab,0x6b69683c8897e3d18e74b1ba117b49f80423da5d,0xede0c2e70e8e2d54609c1bdf79595506b6f623fe,1000000000000,3600,0x7161e4228c18fd6432ba37cb0959663b81d53bc905197770965abcbad9068a8d,40357229,0xcd68113867a16cc1348eb415e0fd2df54227f8ec0b0234a5f17665dda8922a07,gnosis
0x7e9baf7cc7cd83bacefb9b2d5c5124c0f9c30834,0,0xeb522ba17a582b8df500bf107d13b1099eaa091c,0xcf6dc192dc292d5f2789da2db02d6dd4f41f4214,0xede0c2e70e8e2d54609c1bdf79595506b6f623fe,1000000000000,3600,0x639627a76cbaf2ac8f44ad44ed596bc77ee42f85f85d45b1e0b7e4525870e1d9,40357460,0x846ebb004a7d4993f868a0c7d8c0ec1718143cdf4c146a1bde78a87ab6e9be9c,gnosis
0x7e9baf7cc7cd83bacefb9b2d5c5124c0f9c30834,4,0x39c90767e9fe8f10c3a83b003657ebba7068bbab,0xede0c2e70e8e2d54609c1bdf79595506b6f623fe,0xcf6dc192dc292d5f2789da2db02d6dd4f41f4214,1000000000000,3600,0x639627a76cbaf2ac8f44ad44ed596bc77ee42f85f85d45b1e0b7e4525870e1d9,40357460,0x846ebb004a7d4993f868a0c7d8c0ec1718143cdf4c146a1bde78a87ab6e9be9c,gnosis`;

let allSubscriptions: ProcessedSubscription[] = [];

function formatFrequency(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 2592000)}mo`;
}

function formatAmount(amount: string): string {
  // Convert from wei-like format to readable format
  const num = parseFloat(amount) / 1000000000000; // Adjust divisor as needed
  return num.toFixed(2);
}

function processSubscription(sub: SubscriptionData): ProcessedSubscription {
  return {
    ...sub,
    formattedAmount: formatAmount(sub.amount),
    formattedFrequency: formatFrequency(sub.frequency),
    blockNumber: sub.block_number,
    transactionIndex: 0,
    logIndex: 0,
  };
}

// Parse CSV data on module load
Papa.parse(CSV_DATA, {
  header: true,
  skipEmptyLines: true,
  transform: (value: string, header: string) => {
    // Convert numeric fields
    if (['frequency', 'block_number'].includes(header)) {
      return parseInt(value, 10);
    }
    return value;
  },
  complete: (results: any) => {
    allSubscriptions = results.data.map((sub: SubscriptionData) =>
      processSubscription(sub)
    );
  },
});

export const subscriptionStore = readable(
  {
    data: [] as ProcessedSubscription[],
    next: async () => false,
    ended: true,
  },
  (set) => {
    // Initialize with empty data
    set({
      data: [],
      next: async () => false,
      ended: true,
    });
  }
);

export function getSubscriptionsForAddress(address: string) {
  const userAddress = address.toLowerCase();
  const subscriptions = allSubscriptions.filter(
    (sub) => sub.subscriber.toLowerCase() === userAddress
  );

  return readable({
    data: subscriptions,
    next: async () => false,
    ended: true,
  });
}

export function getSubscribersForAddress(address: string) {
  const userAddress = address.toLowerCase();
  const subscribers = allSubscriptions.filter(
    (sub) => sub.recipient.toLowerCase() === userAddress
  );

  return readable({
    data: subscribers,
    next: async () => false,
    ended: true,
  });
}
