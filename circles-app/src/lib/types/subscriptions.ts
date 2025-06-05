import type { EventRow } from '@circles-sdk/data';

export interface SubscriptionData {
  contract_address: string;
  sub_id: string;
  module: string;
  subscriber: string;
  recipient: string;
  amount: string;
  frequency: number; // in seconds
  tx_hash: string;
  block_number: number;
  block_hash: string;
  network: string;
}

export interface ProcessedSubscription extends SubscriptionData, EventRow {
  formattedAmount: string;
  formattedFrequency: string;
}