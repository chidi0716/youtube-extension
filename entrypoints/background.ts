export default defineBackground(() => {
  console.log('[youtube-extension] background started', { id: browser.runtime.id });
});
