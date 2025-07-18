<script lang="ts">
  import { tokenTypeToString } from '$lib/pages/SelectAsset.svelte';
  import { roundToDecimals } from '$lib/utils/shared';
  import type { TokenBalanceRow } from '@circles-sdk/data';
  import Avatar from '$lib/components/avatar/Avatar.svelte';
  import type { Address } from '@circles-sdk/utils';

  interface Props {
    receiverAddress: Address | undefined;
    asset: TokenBalanceRow;
    amount?: number;
    textButton: string;
    data: string | undefined;
    dataType: 'hex' | 'utf-8' | undefined;
    onselect: () => void;
  }

  let {
    receiverAddress,
    asset,
    amount = 0,
    textButton,
    data,
    dataType,
    onselect,
  }: Props = $props();
</script>

<!-- Receiver Information -->
<div class="mt-4 flex flex-col gap-y-4">
  <p class="menu-title p-0">Asset:</p>

  <div
    class="flex items-center justify-between p-4 border-b md:border md:rounded-lg"
  >
    <div class="col">
      <Avatar
        address={asset?.tokenOwner}
        clickable={false}
        bottomInfo={tokenTypeToString(asset?.tokenType)}
        view="horizontal"
      />
    </div>

    <div class="col text-right">
      <span class="text-2xl">{roundToDecimals(amount)}</span> Circles
    </div>
  </div>
  <p class="menu-title mt-8 md:mt-4 p-0">To:</p>
  <div
    class="flex items-center justify-between p-4 border-b md:border md:rounded-lg"
  >
    <Avatar address={receiverAddress} clickable={false} view="horizontal" />
  </div>

  <!-- If there's user-supplied data, display it -->
  {#if data}
    <p class="menu-title mt-8 md:mt-4 p-0">Data:</p>
    <div
      class="flex items-center justify-between p-4 border-b md:border md:rounded-lg"
    >
      {#if dataType === 'hex'}
        <!-- Show hex data in a code block -->
        <code class="break-all">{data}</code>
      {:else}
        <!-- Show UTF-8 or anything else as text -->
        <span>{data}</span>
      {/if}
    </div>
  {/if}

  <!-- Action Buttons -->
  <div class="flex justify-end space-x-2 mt-6">
    <button
      type="submit"
      class="btn btn-primary text-white max-sm:w-full"
      onclick={() => onselect()}
    >
      {textButton}
    </button>
  </div>
</div>
