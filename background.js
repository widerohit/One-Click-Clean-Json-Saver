importScripts("utils.js");

const DEFAULT_SETTINGS = {
  captureEnabled: true,
  maxRequests: 50,
  defaultSearchText: "",
  cleanFields: "headers,cookie,cookies,metadata,meta,config,request,requestInfo,request_info,xhr,http,rawHeaders"
};

const requestsByTab = new Map();
const hookReadyTabs = new Set();

chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    maxRequests: Math.min(Math.max(Number(stored.maxRequests) || 50, 10), 200)
  };
}

function getTabRequests(tabId) {
  if (!requestsByTab.has(tabId)) {
    requestsByTab.set(tabId, []);
  }

  return requestsByTab.get(tabId);
}

function updateBadge(tabId) {
  const count = getTabRequests(tabId).length;

  chrome.action.setBadgeText({
    tabId,
    text: count ? String(Math.min(count, 99)) : ""
  });
}

async function addCapturedRequest(tabId, payload) {
  const settings = await getSettings();

  if (!settings.captureEnabled) {
    return;
  }

  const parsedBody = safeParseJson(payload.body);

  if (!parsedBody) {
    return;
  }

  const capturedAt = Date.now();
  const requests = getTabRequests(tabId);

  requests.unshift({
    id: crypto.randomUUID(),
    url: payload.url,
    method: payload.method || "GET",
    status: payload.status || 0,
    body: payload.body,
    contentHash: createContentHash(parsedBody),
    sizeBytes: getByteSize(payload.body),
    capturedAt
  });

  if (requests.length > settings.maxRequests) {
    requests.length = settings.maxRequests;
  }

  updateBadge(tabId);
}

function getPublicRequests(tabId) {
  return getTabRequests(tabId).map((request) => ({
    id: request.id,
    url: request.url,
    method: request.method,
    status: request.status,
    contentHash: request.contentHash,
    sizeBytes: request.sizeBytes,
    searchableText: request.body.slice(0, 20000),
    capturedAt: request.capturedAt
  }));
}

function findRequest(tabId, requestId) {
  return getTabRequests(tabId).find((request) => request.id === requestId);
}

function clearTabRequests(tabId) {
  requestsByTab.set(tabId, []);
  updateBadge(tabId);
}

async function downloadCleanJson(tabId, requestId) {
  const request = findRequest(tabId, requestId);
  const settings = await getSettings();

  if (!request) {
    throw new Error("Captured request was not found. Refresh the page and try again.");
  }

  const cleanJson = stringifyCleanJson(request.body, settings.cleanFields);

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
  const settings = await getSettings();

  if (!request) {
    throw new Error("Captured request was not found. Refresh the page and try again.");
  }

  const cleanJson = stringifyCleanJson(request.body, settings.cleanFields);

  if (!cleanJson) {
    throw new Error("The selected response is no longer valid JSON.");
  }

  return cleanJson;
}

function createSafeResponseFilename(request, index) {
  let path = "api-response";

  try {
    const parsed = new URL(request.url);
    path = `${parsed.hostname}${parsed.pathname}`;
  } catch (_error) {
    path = request.url || "api-response";
  }

  const safePath = path
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${String(index + 1).padStart(2, "0")}-${safePath || "api-response"}.json`;
}

async function getAllCleanJsonEntries(tabId) {
  const requests = getTabRequests(tabId);
  const settings = await getSettings();

  if (!requests.length) {
    throw new Error("No captured JSON responses to export as ZIP.");
  }

  const entries = requests
    .map((request) => {
      const parsed = safeParseJson(request.body);

      if (parsed === null) {
        return null;
      }

      const data = {
        url: request.url,
        method: request.method,
        status: request.status,
        sizeBytes: request.sizeBytes,
        capturedAt: new Date(request.capturedAt).toISOString(),
        data: cleanJsonValue(parsed, settings.cleanFields)
      };

      return {
        filename: createSafeResponseFilename(request, requests.indexOf(request)),
        content: JSON.stringify(data, null, 2)
      };
    })
    .filter(Boolean);

  if (!entries.length) {
    throw new Error("No valid JSON responses to export as ZIP.");
  }

  return {
    filename: createExportAllFilename().replace(".json", ".zip"),
    entries
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id ?? message.tabId;

  if (message.type === "JSON_API_RESPONSE_CAPTURED" && Number.isInteger(tabId)) {
    addCapturedRequest(tabId, message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "PAGE_HOOK_READY" && Number.isInteger(tabId)) {
    hookReadyTabs.add(tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "GET_CAPTURED_REQUESTS") {
    getSettings()
      .then((settings) =>
        sendResponse({
          ok: true,
          hookReady: hookReadyTabs.has(message.tabId),
          captureEnabled: settings.captureEnabled,
          requests: getPublicRequests(message.tabId)
        })
      )
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CLEAR_CAPTURED_REQUESTS") {
    clearTabRequests(message.tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SAVE_CLEAN_JSON") {
    downloadCleanJson(message.tabId, message.requestId)
      .then((downloadId) => sendResponse({ ok: true, downloadId }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_ALL_CLEAN_JSON_ENTRIES_FOR_ZIP") {
    getAllCleanJsonEntries(message.tabId)
      .then((exportData) => sendResponse({ ok: true, ...exportData }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_CLEAN_JSON_FOR_COPY") {
    copyCleanJson(message.tabId, message.requestId)
      .then((json) => sendResponse({ ok: true, json }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_RESPONSE_PREVIEW") {
    getSettings()
      .then((settings) => {
        const request = findRequest(message.tabId, message.requestId);

        if (!request) {
          throw new Error("Captured request was not found. Refresh the page and try again.");
        }

        const rawJson = JSON.stringify(safeParseJson(request.body), null, 2);
        const cleanJson = stringifyCleanJson(request.body, settings.cleanFields);
        sendResponse({ ok: true, rawJson, cleanJson });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "SET_CAPTURE_ENABLED") {
    chrome.storage.local
      .set({ captureEnabled: Boolean(message.enabled) })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  requestsByTab.delete(tabId);
  hookReadyTabs.delete(tabId);
  chrome.action.setBadgeText({ tabId, text: "" });
});
