// Shared settings, synced across the user's browsers.
export const enabled = storage.defineItem<boolean>('sync:enabled', {
  fallback: true,
});
