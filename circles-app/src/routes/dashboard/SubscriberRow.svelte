<script lang="ts">
  import Avatar from '$lib/components/avatar/Avatar.svelte';
  import type { ProcessedSubscription } from '$lib/types/subscriptions';
  import { SubscriptionCategory } from '$lib/types/subscriptions';

  interface Props {
    item: ProcessedSubscription;
  }

  let { item }: Props = $props();

  function shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function shortenTxHash(hash: string): string {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  function getCategoryColor(category: SubscriptionCategory): string {
    switch (category) {
      case SubscriptionCategory.TRUSTED:
        return 'bg-blue-100 text-blue-800';
      case SubscriptionCategory.GROUP:
        return 'bg-purple-100 text-purple-800';
      case SubscriptionCategory.UNTRUSTED:
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<a
  class="flex items-center justify-between p-2 hover:bg-black/5 rounded-lg"
  target="_blank"
  href={'https://gnosisscan.io/tx/' + item.tx_hash}
>
  <div class="flex-1">
    <Avatar
      address={item.subscriber as `0x${string}`}
      view="horizontal"
      pictureOverlayUrl="/badge-received.svg"
      topInfo={`Subscription #${item.sub_id}`}
      bottomInfo={`From: ${shortenAddress(item.subscriber)}`}
    />
  </div>

  <div class="flex flex-col items-end text-right ml-4">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-green-600 font-bold">
        +{item.formattedAmount} CRC
      </span>
      <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
        Every {item.formattedFrequency}
      </span>
    </div>

    <div class="flex items-center gap-2 mb-1">
      <span class="text-xs {getCategoryColor(item.category)} px-2 py-1 rounded">
        {item.formattedCategory}
      </span>
    </div>

    <div class="text-xs text-gray-500 space-y-1">
      <div>Tx: {shortenTxHash(item.tx_hash)}</div>
      <div>Block: {item.block_number.toLocaleString()}</div>
    </div>
  </div>
</a>
