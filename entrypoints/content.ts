export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    // YouTube is a single-page app: page changes fire `yt-navigate-finish`
    // instead of reloading, so features must re-run on each navigation.
    const onNavigate = async () => {
      if (!(await enabled.getValue())) return;
      console.log('[youtube-extension] page:', location.pathname);
    };

    ctx.addEventListener(document, 'yt-navigate-finish' as keyof DocumentEventMap, onNavigate);
    await onNavigate();
  },
});
