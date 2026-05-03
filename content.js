(function initializeJsonCaptureBridge() {
  const MESSAGE_SOURCE = "one-click-clean-json-saver";
  const PING_SOURCE = "one-click-clean-json-saver-ping";

  function sendToBackground(message) {
    if (!chrome?.runtime?.id) {
      return;
    }

    try {
      chrome.runtime.sendMessage(message, () => {
        // Reading lastError prevents harmless async messaging errors from surfacing.
        if (chrome.runtime.lastError) {
          return;
        }
      });
    } catch (_error) {
      // Ignore messages after extension reloads or on pages where the context is gone.
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data?.source === PING_SOURCE && event.data.type === "PAGE_HOOK_READY") {
      sendToBackground({ type: "PAGE_HOOK_READY" });
      return;
    }

    if (event.data?.source !== MESSAGE_SOURCE) {
      return;
    }

    if (event.data.type === "JSON_API_RESPONSE_CAPTURED") {
      sendToBackground({
        type: "JSON_API_RESPONSE_CAPTURED",
        payload: event.data.payload
      });
    }
  });
})();
