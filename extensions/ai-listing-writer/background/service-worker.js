/**
 * AI Listing Writer - Service Worker (Background)
 */
try { importScripts('../shared/logger.js'); } catch (e) { /* logger optional */ }
const L = (typeof Logger !== 'undefined')
  ? Logger
  : { info() {}, warn() {}, error() {}, flush() {} };

chrome.runtime.onInstalled.addListener((details) => {
  L.info('lifecycle', `onInstalled: ${details.reason}`);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  L.info('message', `received '${message && message.action}'`, {
    from: sender && (sender.tab ? `tab ${sender.tab.id}` : 'popup')
  });
  if (message.action === 'openTab') {
    chrome.tabs.create({ url: message.url });
    sendResponse({ success: true });
  }
  return true;
});
