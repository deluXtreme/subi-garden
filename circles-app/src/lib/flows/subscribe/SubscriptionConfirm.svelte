<script lang="ts">
  import type { SubscriptionFlowContext } from './context';
  import { FREQUENCY_OPTIONS } from './context';
  import { SubscriptionCategory } from '$lib/types/subscriptions';
  import { formatCategory } from '$lib/utils/contractUtils';
  import FlowDecoration from '$lib/flows/FlowDecoration.svelte';
  import { runTask } from '$lib/utils/tasks';
  import { roundToDecimals, shortenAddress } from '$lib/utils/shared';
  import { avatarState } from '$lib/stores/avatar.svelte';
  import { popupControls } from '$lib/stores/popUp';
  import Avatar from '$lib/components/avatar/Avatar.svelte';
  import { createSubscriptionFlowBatched } from '$lib/utils/subscriptionUtils';

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
    if (context.category === undefined) {
      throw new Error('No category specified');
    }

    const subscriptionPromise = createSubscriptionFlowBatched({
      subscriber: avatarState.avatar.address,
      recipient: context.selectedAddress,
      amount: context.amount,
      frequency: context.frequencySeconds,
      tokenAddress: context.selectedAsset.tokenAddress,
      category: context.category,
    });

    runTask({
      name: `Creating subscription: ${roundToDecimals(context.amount)} CRC ${FREQUENCY_OPTIONS.find((opt) => opt.value === context.frequency)?.label.toLowerCase()} to ${shortenAddress(context.selectedAddress)}...`,
      promise: subscriptionPromise.then((result) => {
        console.log('Subscription created with ID:', result.subscriptionId);
        return result.txHash;
      }),
    });

    popupControls.close();
  }

  const frequencyLabel = FREQUENCY_OPTIONS.find(
    (opt) => opt.value === context.frequency
  )?.label;
</script>

<FlowDecoration>
  <p class="text-2xl font-bold">Confirm Subscription</p>

  <div class="w-full max-w-md mx-auto space-y-6">
    <!-- Recipient Info -->
    <div class="flex items-center justify-center">
      <Avatar
        address={context.selectedAddress}
        view="vertical"
        clickable={false}
      />
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
          <span class="text-gray-600">Type:</span>
          <span class="font-medium">{formatCategory(context.category)}</span>
        </div>

        <div class="flex justify-between">
          <span class="text-gray-600">Recipient:</span>
          <span class="font-medium"
            >{shortenAddress(context.selectedAddress || '')}</span
          >
        </div>

        <div class="flex justify-between">
          <span class="text-gray-600">Token:</span>
          <span class="font-medium"
            >{context.selectedAsset.tokenType || 'CRC'}</span
          >
        </div>
      </div>
    </div>

    <!-- Category-specific Info -->
    {#if context.category === SubscriptionCategory.TRUSTED}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg
              class="h-5 w-5 text-blue-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-blue-800">
              This subscription uses your trust network for efficient transfers.
              Payments will be routed through trusted connections.
            </p>
          </div>
        </div>
      </div>
    {:else if context.category === SubscriptionCategory.GROUP}
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg
              class="h-5 w-5 text-purple-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"
              />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-purple-800">
              This subscription involves group tokens. Your CRC tokens will be
              used to mint group tokens for the recipient.
            </p>
          </div>
        </div>
      </div>
    {:else}
      <div class="bg-green-50 border border-green-200 rounded-lg p-3">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg
              class="h-5 w-5 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-green-800">
              This subscription uses direct token transfers. Fast and simple -
              no trust network required.
            </p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Warning Message -->
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg
            class="h-5 w-5 text-yellow-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-yellow-800">
            This will create a recurring payment. Make sure you have sufficient
            balance for future payments.
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
