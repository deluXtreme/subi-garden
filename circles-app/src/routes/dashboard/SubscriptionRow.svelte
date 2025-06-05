<script lang="ts">
  import Avatar from '$lib/components/avatar/Avatar.svelte';
  import type { ProcessedSubscription } from '$lib/types/subscriptions';

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
</script>

<a
  class="flex items-center justify-between p-2 hover:bg-black/5 rounded-lg"
  target="_blank"
  href={'https://gnosisscan.io/tx/' + item.tx_hash}
>
  <div class="flex-1">
    <Avatar
      address={item.recipient as `0x${string}`}
      view="horizontal"
      pictureOverlayUrl="/badge-sent.svg"
      topInfo={`Subscription #${item.sub_id}`}
      bottomInfo={`To: ${shortenAddress(item.recipient)}`}
    />
  </div>

  <div class="flex flex-col items-end text-right ml-4">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-blue-600 font-bold">
        {item.formattedAmount} CRC
      </span>
      <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
        Every {item.formattedFrequency}
      </span>
    </div>

    <div class="text-xs text-gray-500 space-y-1">
      <div>Tx: {shortenTxHash(item.tx_hash)}</div>
      <div>Block: {item.block_number.toLocaleString()}</div>
    </div>
  </div>
</a>
