(function initializeJsonCaptureBridge() {
  const MESSAGE_SOURCE = "one-click-clean-json-saver";
  const PING_SOURCE = "one-click-clean-json-saver-ping";

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data?.source === PING_SOURCE && event.data.type === "PAGE_HOOK_READY") {
      chrome.runtime.sendMessage({ type: "PAGE_HOOK_READY" });
      return;
    }

    if (event.data?.source !== MESSAGE_SOURCE) {
      return;
    }

    if (event.data.type === "JSON_API_RESPONSE_CAPTURED") {
      chrome.runtime.sendMessage({
        type: "JSON_API_RESPONSE_CAPTURED",
        payload: event.data.payload
      });
    }
  });
})();
