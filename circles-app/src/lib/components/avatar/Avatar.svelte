<script lang="ts" module>
  import { ethers } from 'ethers';

  export type CirclesSafeMap = { [safeAddress: string]: Profile };
  export const CirclesGardenApi = `https://api.circles.garden/`;

  async function queryCirclesGarden(
    safeAddresses: string[]
  ): Promise<CirclesSafeMap> {
    const safeAddressCopy = JSON.parse(JSON.stringify(safeAddresses));
    const batches: string[][] = [];

    while (safeAddressCopy.length) {
      batches.push(safeAddressCopy.splice(0, 50));
    }

    const circlesSafeMap: CirclesSafeMap = {};

    if (batches.length == 0) {
      return circlesSafeMap;
    }

    for (const batch of batches) {
      const query = batch.reduce(
        (p, c) => p + `address[]=${ethers.getAddress(c)}&`,
        ''
      );
      const requestUrl = `${CirclesGardenApi}api/users/?${query}`;

      const requestResult = await fetch(requestUrl);
      const requestResultJson = await requestResult.json();

      const profiles: (Profile & { safeAddress: string })[] =
        requestResultJson.data.map((o: any) => {
          return {
            name: o.username,
            previewImageUrl: o.avatarUrl,
            safeAddress: o.safeAddress?.toLowerCase(),
          };
        }) ?? [];

      profiles.forEach((o) => {
        if (!o.safeAddress) return;
        circlesSafeMap[o.safeAddress] = o;
      }, circlesSafeMap);
    }

    return circlesSafeMap;
  }

  // Implementing the batching mechanism
  const getProfileQueue: {
    address: string;
    resolve: (data: Profile | undefined) => void;
  }[] = [];

  setInterval(async () => {
    if (getProfileQueue.length === 0) {
      return;
    }

    const queueCopy = getProfileQueue.slice();
    const profilesToQuery = queueCopy.map((o) => o.address);
    getProfileQueue.splice(0, getProfileQueue.length); // Clear the queue

    try {
      const circlesGardenResults = await queryCirclesGarden(profilesToQuery);

      queueCopy.forEach((o) => {
        const profile = circlesGardenResults[o.address] ?? {};
        o.resolve(profile);
      });
    } catch (error) {
      // Handle errors if needed
      queueCopy.forEach((o) => {
        o.resolve(undefined); // Or reject(...) if preferred
      });
    }
  }, 20);
</script>

<script lang="ts">
  import ProfilePage from '$lib/pages/Profile.svelte';
  import { getProfile } from '$lib/utils/profile';
  import HorizontalAvatarLayout from './HorizontalAvatarLayout.svelte';
  import VerticalAvatarLayout from './VerticalAvatarLayout.svelte';
  import {
    popupControls,
    type PopupContentDefinition,
  } from '$lib/stores/popUp';
  import type { Address } from '@circles-sdk/utils';
  import type { Profile } from '@circles-sdk/profiles';
  import { shortenAddress } from '$lib/utils/shared';

  // Import the "fade" transition
  import { fade } from 'svelte/transition';

  interface Props {
    address: Address | undefined;
    clickable?: boolean;
    view: 'horizontal' | 'vertical';
    pictureOverlayUrl?: string | undefined;
    topInfo?: string | undefined;
    bottomInfo?: string | undefined;

    /**
     * Control whether to show placeholders for each position
     * so the layout doesn’t shift if you sometimes use them.
     */
    placeholderAvatar?: boolean;
    placeholderTop?: boolean;
    placeholderBottom?: boolean;
  }

  let {
    address,
    clickable = true,
    view,
    pictureOverlayUrl,
    topInfo,
    bottomInfo,

    // Default placeholders to true
    placeholderAvatar = true,
    placeholderTop = true,
    placeholderBottom = true,
  }: Props = $props();

  let profile: Profile | undefined = $state();

  $effect(() => {
    if (address) {
      getProfile(address).then((newProfile) => {
        profile = newProfile;
      });
    }
  });

  function openAvatar(e: MouseEvent) {
    if (!clickable) return;

    const nextPage: PopupContentDefinition = {
      title: shortenAddress(address),
      component: ProfilePage,
      props: { address },
    };
    popupControls.open(nextPage);

    e?.preventDefault();
  }
</script>

<!-- If no profile, show placeholders; otherwise fade in final layout. -->

{#if !profile}
  <!--
    Blank placeholders, keeping the same approximate width/height as
    the final layouts. This prevents layout shifting.
  -->
  {#if view === 'horizontal'}
    <div
      class="flex items-center gap-2 p-2 rounded-lg w-full"
      style="min-height: 3rem;"
    >
      <!-- Placeholder for avatar -->
      {#if placeholderAvatar}
        <div class="w-8 h-8 rounded-full bg-transparent">&nbsp;</div>
      {/if}

      <div class="flex flex-col justify-center">
        {#if placeholderTop}
          <div class="text-base font-semibold">&nbsp;</div>
        {/if}
        {#if placeholderBottom}
          <div class="text-sm opacity-75">&nbsp;</div>
        {/if}
      </div>
    </div>
  {:else}
    <div
      class="flex flex-col items-center gap-2 p-2 rounded-lg w-full"
      style="min-height: 6rem;"
    >
      {#if placeholderAvatar}
        <div class="w-12 h-12 rounded-full bg-transparent">&nbsp;</div>
      {/if}
      {#if placeholderTop}
        <div class="text-base font-semibold w-full text-center">&nbsp;</div>
      {/if}
      {#if placeholderBottom}
        <div class="text-sm opacity-75 w-full text-center">&nbsp;</div>
      {/if}
    </div>
  {/if}
{:else if view === 'horizontal'}
  <!-- Fade in the final layout once profile is loaded -->
  <div transition:fade>
    <HorizontalAvatarLayout
      {pictureOverlayUrl}
      onclick={openAvatar}
      {profile}
      {topInfo}
      {bottomInfo}
    />
  </div>
{:else}
  <div transition:fade>
    <VerticalAvatarLayout onclick={openAvatar} {profile} />
  </div>
{/if}
