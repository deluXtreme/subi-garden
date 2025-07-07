<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { CATEGORY_OPTIONS, type SubscriptionCategoryOption } from './context';
  import { SubscriptionCategory } from '$lib/types/subscriptions';

  interface Props {
    selectedCategory?: SubscriptionCategory;
  }

  let { selectedCategory = $bindable(SubscriptionCategory.UNTRUSTED) }: Props =
    $props();

  const dispatch = createEventDispatcher<{
    categoryChanged: SubscriptionCategory;
  }>();

  function handleCategoryChange(category: SubscriptionCategory) {
    selectedCategory = category;
    dispatch('categoryChanged', category);
  }
</script>

<div class="subscription-category-selector">
  <h3 class="text-lg font-semibold mb-4">Select Subscription Type</h3>

  <div class="space-y-3">
    {#each CATEGORY_OPTIONS as option}
      <label
        class="category-option"
        class:selected={selectedCategory === option.value}
      >
        <input
          type="radio"
          name="category"
          value={option.value}
          bind:group={selectedCategory}
          on:change={() => handleCategoryChange(option.value)}
          class="sr-only"
        />

        <div class="category-card">
          <div class="flex items-start">
            <div
              class="radio-indicator"
              class:checked={selectedCategory === option.value}
            >
              <div class="radio-dot"></div>
            </div>

            <div class="flex-1 ml-3">
              <div class="category-header">
                <h4 class="font-medium text-gray-900">{option.label}</h4>
                {#if option.value === SubscriptionCategory.TRUSTED}
                  <span class="category-badge recommended">Recommended</span>
                {/if}
              </div>

              <p class="category-description">{option.description}</p>

              <!-- Additional information based on category -->
              {#if option.value === SubscriptionCategory.TRUSTED}
                <div class="category-info">
                  <span class="info-icon">ℹ️</span>
                  <span class="info-text"
                    >Uses your trust network for efficient transfers</span
                  >
                </div>
              {:else if option.value === SubscriptionCategory.UNTRUSTED}
                <div class="category-info">
                  <span class="info-icon">⚡</span>
                  <span class="info-text"
                    >Fastest option - direct token transfers</span
                  >
                </div>
              {:else if option.value === SubscriptionCategory.GROUP}
                <div class="category-info">
                  <span class="info-icon">👥</span>
                  <span class="info-text"
                    >For group tokens and community subscriptions</span
                  >
                </div>
              {/if}
            </div>
          </div>
        </div>
      </label>
    {/each}
  </div>

  <!-- Help text -->
  <div class="help-text">
    <p class="text-sm text-gray-600">
      Choose the type that best fits your subscription needs. You can change
      this for each subscription.
    </p>
  </div>
</div>

<style>
  .subscription-category-selector {
    @apply w-full max-w-md mx-auto;
  }

  .category-option {
    @apply block cursor-pointer transition-all duration-200;
  }

  .category-option:hover .category-card {
    @apply shadow-md border-blue-200;
  }

  .category-option.selected .category-card {
    @apply border-blue-500 bg-blue-50;
  }

  .category-card {
    @apply border border-gray-200 rounded-lg p-4 bg-white transition-all duration-200;
  }

  .radio-indicator {
    @apply w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center mt-0.5 flex-shrink-0;
  }

  .radio-indicator.checked {
    @apply border-blue-500 bg-blue-500;
  }

  .radio-dot {
    @apply w-2 h-2 bg-white rounded-full opacity-0 transition-opacity duration-200;
  }

  .radio-indicator.checked .radio-dot {
    @apply opacity-100;
  }

  .category-header {
    @apply flex items-center justify-between mb-2;
  }

  .category-badge {
    @apply px-2 py-1 text-xs font-medium rounded-full;
  }

  .category-badge.recommended {
    @apply bg-green-100 text-green-800;
  }

  .category-description {
    @apply text-sm text-gray-600 mb-2;
  }

  .category-info {
    @apply flex items-center text-xs text-gray-500;
  }

  .info-icon {
    @apply mr-1;
  }

  .info-text {
    @apply italic;
  }

  .help-text {
    @apply mt-6 p-3 bg-gray-50 rounded-lg;
  }
</style>
