(function installOneClickCleanJsonSaverPageHook() {
  const MESSAGE_SOURCE = "one-click-clean-json-saver";
  const PING_SOURCE = "one-click-clean-json-saver-ping";

  if (window.__oneClickCleanJsonSaverInstalled) {
    return;
  }

  window.__oneClickCleanJsonSaverInstalled = true;

  function looksLikeJson(text) {
    if (typeof text !== "string") {
      return false;
    }

    const trimmed = text.trim();
    return (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    );
  }

  function postReady() {
    window.postMessage(
      {
        source: PING_SOURCE,
        type: "PAGE_HOOK_READY"
      },
      "*"
    );
  }

  function postCapture(payload) {
    if (!looksLikeJson(payload.body)) {
      return;
    }

    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: "JSON_API_RESPONSE_CAPTURED",
        payload
      },
      "*"
    );
  }

  function getFetchMethod(input, init) {
    return init?.method || input?.method || "GET";
  }

  function getFetchUrl(input) {
    if (typeof input === "string") {
      return input;
    }

    return input?.url || String(input);
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function patchedFetch(input, init) {
      const response = await originalFetch.apply(this, arguments);

      response
        .clone()
        .text()
        .then((body) => {
          postCapture({
            url: getFetchUrl(input),
            method: getFetchMethod(input, init),
            status: response.status,
            body
          });
        })
        .catch(() => {
          // Some responses cannot be cloned/read, such as opaque streams.
        });

      return response;
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
    this.__oneClickCleanJsonSaverRequest = {
      method: method || "GET",
      url: String(url)
    };

    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function patchedSend() {
    this.addEventListener("load", function handleLoad() {
      const request = this.__oneClickCleanJsonSaverRequest || {};

      if (typeof this.responseText !== "string") {
        return;
      }

      postCapture({
        url: request.url || this.responseURL || "Unknown URL",
        method: request.method || "GET",
        status: this.status,
        body: this.responseText
      });
    });

    return originalSend.apply(this, arguments);
  };

  postReady();
  setTimeout(postReady, 250);
  setTimeout(postReady, 1000);
})();
