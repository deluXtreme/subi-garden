import type { EventRow } from '@circles-sdk/data';
import type { Address } from '@circles-sdk/utils';

export enum SubscriptionCategory {
  TRUSTED = 0,
  UNTRUSTED = 1,
  GROUP = 2,
}

export interface SubscriptionData {
  contract_address: string;
  sub_id: string;
  module: string;
  subscriber: string;
  recipient: string;
  amount: string;
  frequency: number; // in seconds
  category: SubscriptionCategory;
  tx_hash: string;
  block_number: number;
  block_hash: string;
  network: string;
}

export interface ProcessedSubscription extends SubscriptionData, EventRow {
  formattedAmount: string;
  formattedFrequency: string;
  formattedCategory: string;
}

export interface SubscriptionParams {
  subscriber: Address;
  recipient: Address;
  amount: number;
  frequency: number;
  tokenAddress: Address;
  category: SubscriptionCategory;
}

export interface SubscriptionResult {
  txHash: `0x${string}`;
  subscriptionId: string;
}
