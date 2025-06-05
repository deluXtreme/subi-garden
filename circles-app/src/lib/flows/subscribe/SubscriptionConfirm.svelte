<script lang="ts">
  import type { SubscriptionFlowContext } from './context';
  import { FREQUENCY_OPTIONS } from './context';
  import FlowDecoration from '$lib/flows/FlowDecoration.svelte';
  import { runTask } from '$lib/utils/tasks';
  import { roundToDecimals, shortenAddress } from '$lib/utils/shared';
  import { avatarState } from '$lib/stores/avatar.svelte';
  import { popupControls } from '$lib/stores/popUp';
  import Avatar from '$lib/components/avatar/Avatar.svelte';
  import { createSubscriptionFlow } from '$lib/utils/subscriptionUtils';

  interface Props {
    context: SubscriptionFlowContext;
  }

  let { context }: Props = $props();

  function onConfirm() {
    if (!avatarState.avatar) {
      throw new Error('Avatar not found');
    }
    if (!context.selectedAddress) {
      throw new Error('No address selected');
    }
    if (!context.selectedAsset) {
      throw new Error('No asset selected');
    }
    if (!context.amount) {
      throw new Error('No amount specified');
    }
    if (!context.frequency) {
      throw new Error('No frequency specified');
    }

    const subscriptionPromise = createSubscriptionFlow({
      subscriber: avatarState.avatar.address,
      recipient: context.selectedAddress,
      amount: context.amount,
      frequency: context.frequencySeconds,
      tokenAddress: context.selectedAsset.tokenAddress,
    });

    runTask({
      name: `Creating subscription: ${roundToDecimals(context.amount)} CRC ${FREQUENCY_OPTIONS.find(opt => opt.value === context.frequency)?.label.toLowerCase()} to ${shortenAddress(context.selectedAddress)}...`,
      promise: subscriptionPromise,
    });

    popupControls.close();
  }



  const frequencyLabel = FREQUENCY_OPTIONS.find(opt => opt.value === context.frequency)?.label;
</script>

<FlowDecoration>
  <p class="text-2xl font-bold">Confirm Subscription</p>
  
  <div class="w-full max-w-md mx-auto space-y-6">
    <!-- Recipient Info -->
    <div class="flex items-center justify-center">
      <Avatar address={context.selectedAddress} view="vertical" clickable={false} />
    </div>

    <!-- Subscription Details -->
    <div class="bg-gray-50 rounded-lg p-4 space-y-3">
      <h3 class="text-lg font-semibold text-gray-900">Subscription Details</h3>
      
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">Amount per payment:</span>
          <span class="font-medium">{context.amount} CRC</span>
        </div>
        
        <div class="flex justify-between">
          <span class="text-gray-600">Frequency:</span>
          <span class="font-medium">{frequencyLabel}</span>
        </div>
        
        <div class="flex justify-between">
          <span class="text-gray-600">Recipient:</span>
          <span class="font-medium">{shortenAddress(context.selectedAddress || '')}</span>
        </div>
        
        <div class="flex justify-between">
          <span class="text-gray-600">Token:</span>
          <span class="font-medium">{context.selectedAsset.tokenType || 'CRC'}</span>
        </div>
      </div>
    </div>

    <!-- Warning Message -->
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-yellow-800">
            This will create a recurring payment. Make sure you have sufficient balance for future payments.
          </p>
        </div>
      </div>
    </div>

    <!-- Confirmation Button -->
    <button
      type="button"
      class="btn btn-primary w-full text-white"
      onclick={onConfirm}
    >
      Create Subscription
    </button>
  </div>
</FlowDecoration>