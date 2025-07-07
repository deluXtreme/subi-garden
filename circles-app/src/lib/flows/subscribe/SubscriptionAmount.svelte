<script lang="ts">
  import type { SubscriptionFlowContext } from './context';
  import { FREQUENCY_OPTIONS } from './context';
  import { SubscriptionCategory } from '$lib/types/subscriptions';
  import SubscriptionCategoryComponent from './SubscriptionCategory.svelte';
  import SelectAmount from '$lib/pages/SelectAmount.svelte';
  import SubscriptionConfirm from './SubscriptionConfirm.svelte';
  import FlowDecoration from '$lib/flows/FlowDecoration.svelte';
  import { popupControls } from '$lib/stores/popUp';

  interface Props {
    context: SubscriptionFlowContext;
  }

  let { context = $bindable() }: Props = $props();

  if (context.amount === undefined) {
    context.amount = 0;
  }

  // Create local reactive state for frequency, amount, and category
  let selectedFrequency = $state(context.frequency || 'daily');
  let selectedFrequencySeconds = $state(context.frequencySeconds || 86400);
  let selectedAmount = $state(context.amount || 0);
  let selectedCategory = $state(
    context.category !== undefined
      ? context.category
      : SubscriptionCategory.UNTRUSTED
  );

  // Sync local state with context
  $effect(() => {
    context.frequency = selectedFrequency;
    context.frequencySeconds = selectedFrequencySeconds;
    context.amount = selectedAmount;
    context.category = selectedCategory;
  });

  function selectFrequency(option: (typeof FREQUENCY_OPTIONS)[0]) {
    selectedFrequency = option.value;
    selectedFrequencySeconds = option.seconds;
  }

  function handleCategoryChange(category: SubscriptionCategory) {
    selectedCategory = category;
  }

  function handleContinue() {
    console.log('Subscription details:', {
      amount: context.amount,
      frequency: context.frequency,
      frequencySeconds: context.frequencySeconds,
      category: context.category,
      selectedAddress: context.selectedAddress,
      selectedAsset: context.selectedAsset,
    });

    popupControls.open({
      title: 'Confirm Subscription',
      component: SubscriptionConfirm,
      props: {
        context,
      },
    });
  }
</script>

<FlowDecoration>
  <p class="text-2xl font-bold">Create Subscription</p>

  <!-- Amount Selection -->
  <SelectAmount
    maxAmountCircles={context.selectedAsset.isErc20
      ? context.selectedAsset.staticCircles
      : 1000}
    asset={context.selectedAsset}
    bind:amount={selectedAmount}
  />

  <!-- Frequency Selection -->
  <div class="mt-6">
    <h3 class="block text-sm font-medium text-gray-700 mb-3">
      Payment Frequency
    </h3>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
      {#each FREQUENCY_OPTIONS as option}
        <button
          type="button"
          class="btn {selectedFrequency === option.value
            ? 'btn-primary'
            : 'btn-outline'} text-sm"
          onclick={() => selectFrequency(option)}
        >
          {option.label}
        </button>
      {/each}
    </div>

    {#if selectedFrequency}
      <div class="mt-3 text-sm text-gray-600">
        Payment will be sent every {selectedFrequencySeconds.toLocaleString()} seconds
        ({FREQUENCY_OPTIONS.find(
          (opt) => opt.value === selectedFrequency
        )?.label.toLowerCase()})
      </div>
    {/if}
  </div>

  <!-- Category Selection -->
  <div class="mt-6">
    <SubscriptionCategoryComponent
      bind:selectedCategory
      on:categoryChanged={(e: CustomEvent<SubscriptionCategory>) =>
        handleCategoryChange(e.detail)}
    />
  </div>

  <!-- Summary -->
  {#if selectedAmount && selectedFrequency}
    <div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 class="text-sm font-medium text-blue-900 mb-2">
        Subscription Summary
      </h3>
      <div class="text-sm text-blue-800">
        <div>Amount: <span class="font-medium">{selectedAmount} CRC</span></div>
        <div>
          Frequency: <span class="font-medium"
            >{FREQUENCY_OPTIONS.find((opt) => opt.value === selectedFrequency)
              ?.label}</span
          >
        </div>
        <div>
          Type: <span class="font-medium"
            >{selectedCategory === SubscriptionCategory.TRUSTED
              ? 'Trusted'
              : selectedCategory === SubscriptionCategory.GROUP
                ? 'Group'
                : 'Direct'}</span
          >
        </div>
        <div>
          Recipient: <span class="font-medium"
            >{context.selectedAddress?.slice(
              0,
              6
            )}...{context.selectedAddress?.slice(-4)}</span
          >
        </div>
      </div>
    </div>
  {/if}

  <!-- Continue Button -->
  <div class="flex justify-end mt-6">
    <button
      type="button"
      class="btn btn-primary text-white"
      onclick={handleContinue}
      disabled={!selectedAmount ||
        !selectedFrequency ||
        selectedCategory === undefined}
    >
      Continue
    </button>
  </div>
</FlowDecoration>
