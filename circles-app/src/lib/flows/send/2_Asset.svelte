<script lang="ts">
  import type { TokenBalanceRow } from '@circles-sdk/data';
  import type { SendFlowContext } from '$lib/flows/send/context';
  import SelectAsset from '$lib/pages/SelectAsset.svelte';
  import SelectAmount from './3_Amount.svelte';
  import SubscriptionAmount from '$lib/flows/subscribe/SubscriptionAmount.svelte';
  import { onMount } from 'svelte';
  import FlowDecoration from '$lib/flows/FlowDecoration.svelte';
  import { circlesBalances } from '$lib/stores/circlesBalances';
  import { popupControls } from '$lib/stores/popUp';
  interface Props {
    context: SendFlowContext;
  }

  let { context = $bindable() }: Props = $props();

  let selectedAsset: TokenBalanceRow | undefined = $state(undefined);

  onMount(() => {
    if (context?.selectedAsset) {
      selectedAsset = context.selectedAsset;
    }
  });

  function onselect(tokenBalanceRow: TokenBalanceRow) {
    context.selectedAsset = tokenBalanceRow;

    // Check if this is a subscription flow
    if (context.isSubscription) {
      popupControls.open({
        title: 'Subscription Amount & Frequency',
        component: SubscriptionAmount,
        props: {
          context: {
            selectedAddress: context.selectedAddress,
            selectedAsset: tokenBalanceRow,
            amount: undefined,
            frequency: 'daily',
            frequencySeconds: 86400,
          },
        },
      });
    } else {
      // Normal send flow
      popupControls.open({
        title: 'Enter Amount',
        component: SelectAmount,
        props: {
          context: context,
        },
      });
    }
  }
</script>

<FlowDecoration>
  <p class="text-2xl font-bold">Select Asset</p>
  <SelectAsset {selectedAsset} balances={circlesBalances} {onselect} />
</FlowDecoration>
