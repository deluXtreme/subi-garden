import type { TokenBalanceRow } from '@circles-sdk/data';
import type { Address } from '@circles-sdk/utils';
import { SubscriptionCategory } from '$lib/types/subscriptions';

export type SubscriptionFrequency =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly';

export interface SubscriptionFrequencyOption {
  label: string;
  value: SubscriptionFrequency;
  seconds: number;
}

export const FREQUENCY_OPTIONS: SubscriptionFrequencyOption[] = [
  { label: 'Hourly', value: 'hourly', seconds: 3600 },
  { label: 'Daily', value: 'daily', seconds: 86400 },
  { label: 'Weekly', value: 'weekly', seconds: 604800 },
  { label: 'Monthly', value: 'monthly', seconds: 2592000 }, // 30 days
  { label: 'Yearly', value: 'yearly', seconds: 31536000 }, // 365 days
];

export interface SubscriptionCategoryOption {
  label: string;
  value: SubscriptionCategory;
  description: string;
}

export const CATEGORY_OPTIONS: SubscriptionCategoryOption[] = [
  {
    label: 'Trusted',
    value: SubscriptionCategory.TRUSTED,
    description: 'Uses trust network pathfinding for token transfers',
  },
  {
    label: 'Direct',
    value: SubscriptionCategory.UNTRUSTED,
    description: 'Direct token transfers without trust requirements',
  },
  {
    label: 'Group',
    value: SubscriptionCategory.GROUP,
    description: 'For subscriptions involving group tokens and minting',
  },
];

export type SubscriptionFlowContext = {
  selectedAddress: Address | undefined;
  selectedAsset: TokenBalanceRow;
  amount: number | undefined;
  frequency: SubscriptionFrequency;
  frequencySeconds: number;
  category: SubscriptionCategory;
};
