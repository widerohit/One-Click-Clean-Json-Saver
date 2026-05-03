importScripts("utils.js");

const MAX_REQUESTS_PER_TAB = 50;
const requestsByTab = new Map();
const hookReadyTabs = new Set();

function getTabRequests(tabId) {
  if (!requestsByTab.has(tabId)) {
    requestsByTab.set(tabId, []);
  }

  return requestsByTab.get(tabId);
}

function addCapturedRequest(tabId, payload) {
  if (!safeParseJson(payload.body)) {
    return;
  }

  const requests = getTabRequests(tabId);

  requests.unshift({
    id: crypto.randomUUID(),
    url: payload.url,
    method: payload.method || "GET",
    status: payload.status || 0,
    body: payload.body,
    capturedAt: Date.now()
  });

  if (requests.length > MAX_REQUESTS_PER_TAB) {
    requests.length = MAX_REQUESTS_PER_TAB;
  }
}

function getPublicRequests(tabId) {
  return getTabRequests(tabId).map((request) => ({
    id: request.id,
    url: request.url,
    method: request.method,
    status: request.status,
    capturedAt: request.capturedAt
  }));
}

function findRequest(tabId, requestId) {
  return getTabRequests(tabId).find((request) => request.id === requestId);
}

async function downloadCleanJson(tabId, requestId) {
  const request = findRequest(tabId, requestId);

  if (!request) {
    throw new Error("Captured request was not found. Refresh the page and try again.");
  }

  const cleanJson = stringifyCleanJson(request.body);

  if (!cleanJson) {
    throw new Error("The selected response is no longer valid JSON.");
  }

  const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(cleanJson)}`;

  return chrome.downloads.download({
    url: dataUrl,
    filename: createDownloadFilename(),
    saveAs: false,
    conflictAction: "uniquify"
  });
}

async function copyCleanJson(tabId, requestId) {
  const request = findRequest(tabId, requestId);

  if (!request) {
    throw new Error("Captured request was not found. Refresh the page and try again.");
  }

  const cleanJson = stringifyCleanJson(request.body);

  if (!cleanJson) {
    throw new Error("The selected response is no longer valid JSON.");
  }

  return cleanJson;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id ?? message.tabId;

  if (message.type === "JSON_API_RESPONSE_CAPTURED" && Number.isInteger(tabId)) {
    addCapturedRequest(tabId, message.payload);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "PAGE_HOOK_READY" && Number.isInteger(tabId)) {
    hookReadyTabs.add(tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "GET_CAPTURED_REQUESTS") {
    sendResponse({
      ok: true,
      hookReady: hookReadyTabs.has(message.tabId),
      requests: getPublicRequests(message.tabId)
    });
    return false;
  }

  if (message.type === "SAVE_CLEAN_JSON") {
    downloadCleanJson(message.tabId, message.requestId)
      .then((downloadId) => sendResponse({ ok: true, downloadId }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_CLEAN_JSON_FOR_COPY") {
    copyCleanJson(message.tabId, message.requestId)
      .then((json) => sendResponse({ ok: true, json }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  requestsByTab.delete(tabId);
  hookReadyTabs.delete(tabId);
});
