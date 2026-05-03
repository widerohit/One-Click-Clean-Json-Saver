const requestList = document.getElementById("requestList");
const searchInput = document.getElementById("searchInput");
const saveSearchButton = document.getElementById("saveSearchButton");
const statusFilter = document.getElementById("statusFilter");
const methodFilter = document.getElementById("methodFilter");
const domainFilterInput = document.getElementById("domainFilterInput");
const footerStatus = document.getElementById("footerStatus");
const previewPanel = document.getElementById("previewPanel");
const previewTitle = document.getElementById("previewTitle");
const previewContent = document.getElementById("previewContent");
const previewSearchInput = document.getElementById("previewSearchInput");
const previousMatchButton = document.getElementById("previousMatchButton");
const nextMatchButton = document.getElementById("nextMatchButton");
const previewSearchStatus = document.getElementById("previewSearchStatus");
const closePreviewButton = document.getElementById("closePreviewButton");
const clearButton = document.getElementById("clearButton");
const exportAllButton = document.getElementById("exportAllButton");
const captureToggleButton = document.getElementById("captureToggleButton");
const optionsButton = document.getElementById("optionsButton");
const previewModeButton = document.getElementById("previewModeButton");

let activeTabId = null;
let capturedRequests = [];
let hookReady = false;
let captureEnabled = true;
let currentPreview = null;
let previewMode = "clean";
let previewMatchCount = 0;
let activePreviewMatchIndex = 0;
const SEARCH_STORAGE_KEY = "savedSearchText";
const DEFAULT_SEARCH_STORAGE_KEY = "defaultSearchText";

function shortenUrl(url) {
  try {
    const parsed = new URL(url, "https://example.invalid");
    return `${parsed.hostname}${parsed.pathname}`;
  } catch (_error) {
    return url;
  }
}

function getHostname(url) {
  try {
    return new URL(url, "https://example.invalid").hostname;
  } catch (_error) {
    return "";
  }
}

function getStatusClass(status) {
  if (status >= 200 && status < 300) {
    return "#0f766e";
  }

  if (status >= 400) {
    return "#b42318";
  }

  return "#7a5d00";
}

function getStatusGroup(status) {
  if (status >= 200 && status < 300) {
    return "2xx";
  }

  if (status >= 300 && status < 400) {
    return "3xx";
  }

  if (status >= 400 && status < 500) {
    return "4xx";
  }

  if (status >= 500 && status < 600) {
    return "5xx";
  }

  return "other";
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function setStatus(text) {
  footerStatus.textContent = text;
}

function getStoredSearchText() {
  return chrome.storage.local.get(SEARCH_STORAGE_KEY);
}

function saveSearchText(value) {
  return chrome.storage.local.set({ [SEARCH_STORAGE_KEY]: value });
}

function saveDefaultSearchText(value) {
  return chrome.storage.local.set({
    [SEARCH_STORAGE_KEY]: value,
    [DEFAULT_SEARCH_STORAGE_KEY]: value
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCaptureTime(timestamp) {
  if (!timestamp) {
    return "Unknown time";
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function makeCrcTable() {
  const table = [];

  for (let i = 0; i < 256; i += 1) {
    let crc = i;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[i] = crc >>> 0;
  }

  return table;
}

const crcTable = makeCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(bytes, value) {
  bytes.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

function createZipBlob(entries) {
  const encoder = new TextEncoder();
  const fileParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.filename);
    const contentBytes = encoder.encode(entry.content);
    const checksum = crc32(contentBytes);
    const localHeader = [];

    writeUint32(localHeader, 0x04034b50);
    writeUint16(localHeader, 20);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint32(localHeader, checksum);
    writeUint32(localHeader, contentBytes.length);
    writeUint32(localHeader, contentBytes.length);
    writeUint16(localHeader, nameBytes.length);
    writeUint16(localHeader, 0);

    fileParts.push(new Uint8Array(localHeader), nameBytes, contentBytes);

    const centralHeader = [];
    writeUint32(centralHeader, 0x02014b50);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, checksum);
    writeUint32(centralHeader, contentBytes.length);
    writeUint32(centralHeader, contentBytes.length);
    writeUint16(centralHeader, nameBytes.length);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, 0);
    writeUint32(centralHeader, offset);

    centralParts.push(new Uint8Array(centralHeader), nameBytes);
    offset += localHeader.length + nameBytes.length + contentBytes.length;
  });

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const endHeader = [];

  writeUint32(endHeader, 0x06054b50);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, entries.length);
  writeUint16(endHeader, entries.length);
  writeUint32(endHeader, centralSize);
  writeUint32(endHeader, offset);
  writeUint16(endHeader, 0);

  return new Blob([...fileParts, ...centralParts, new Uint8Array(endHeader)], {
    type: "application/zip"
  });
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markSearchMatches(html, query) {
  if (!query.trim()) {
    return html;
  }

  const pattern = new RegExp(escapeRegExp(escapeHtml(query.trim())), "gi");
  let index = 0;

  return html.replace(pattern, (match) => {
    const className = index === activePreviewMatchIndex ? "active-match" : "";
    index += 1;
    return `<mark class="${className}" data-match-index="${index - 1}">${match}</mark>`;
  });
}

function highlightJson(jsonText, query = "") {
  const escaped = escapeHtml(jsonText);

  const highlighted = escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let className = "json-number";

      if (match.startsWith('"')) {
        className = match.endsWith(":") ? "json-key" : "json-string";
      } else if (match === "true" || match === "false") {
        className = "json-boolean";
      } else if (match === "null") {
        className = "json-null";
      }

      return `<span class="${className}">${match}</span>`;
    }
  );

  return markSearchMatches(highlighted, query);
}

function setPreviewContent(jsonText) {
  previewContent.innerHTML = highlightJson(jsonText || "", previewSearchInput.value);
  updatePreviewSearchState();
}

function getCurrentPreviewText() {
  if (!currentPreview) {
    return "";
  }

  return previewMode === "clean" ? currentPreview.cleanJson : currentPreview.rawJson;
}

function updatePreviewSearchState() {
  const query = previewSearchInput.value.trim();

  if (!query) {
    previewMatchCount = 0;
    activePreviewMatchIndex = 0;
    previewSearchStatus.textContent = "No search term.";
    return;
  }

  const text = getCurrentPreviewText().toLowerCase();
  const loweredQuery = query.toLowerCase();
  previewMatchCount = 0;
  let position = text.indexOf(loweredQuery);

  while (position !== -1) {
    previewMatchCount += 1;
    position = text.indexOf(loweredQuery, position + loweredQuery.length);
  }

  if (!previewMatchCount) {
    activePreviewMatchIndex = 0;
    previewSearchStatus.textContent = "No matches.";
    return;
  }

  if (activePreviewMatchIndex >= previewMatchCount) {
    activePreviewMatchIndex = 0;
  }

  previewSearchStatus.textContent = `${activePreviewMatchIndex + 1} of ${previewMatchCount} matches`;
  scrollActiveMatchIntoView();
}

function scrollActiveMatchIntoView() {
  const activeMatch = previewContent.querySelector("mark.active-match");

  if (activeMatch) {
    activeMatch.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
  }
}

function movePreviewMatch(direction) {
  if (!previewMatchCount) {
    return;
  }

  activePreviewMatchIndex =
    (activePreviewMatchIndex + direction + previewMatchCount) % previewMatchCount;
  setPreviewContent(getCurrentPreviewText());
}

function getGroupKey(request) {
  return [
    request.method,
    request.status,
    request.url,
    request.contentHash
  ].join("::");
}

function groupDuplicateRequests(requests) {
  const groups = new Map();

  requests.forEach((request) => {
    const key = getGroupKey(request);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        ...request,
        count: 1
      });
      return;
    }

    existing.count += 1;
    existing.sizeBytes += request.sizeBytes || 0;

    if (request.capturedAt > existing.capturedAt) {
      existing.id = request.id;
      existing.capturedAt = request.capturedAt;
    }
  });

  return Array.from(groups.values()).sort((a, b) => b.capturedAt - a.capturedAt);
}

function requestMatchesFilters(request, query, statusValue, methodValue, domainQuery) {
  const url = request.url.toLowerCase();
  const jsonText = (request.searchableText || "").toLowerCase();
  const hostname = getHostname(request.url).toLowerCase();

  if (query && !url.includes(query) && !jsonText.includes(query)) {
    return false;
  }

  if (statusValue !== "all" && getStatusGroup(request.status) !== statusValue) {
    return false;
  }

  if (methodValue !== "all" && request.method !== methodValue) {
    return false;
  }

  if (domainQuery && !hostname.includes(domainQuery)) {
    return false;
  }

  return true;
}

function updateMethodOptions() {
  const currentValue = methodFilter.value || "all";
  const methods = Array.from(new Set(capturedRequests.map((request) => request.method))).sort();

  methodFilter.textContent = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All methods";
  methodFilter.appendChild(allOption);

  methods.forEach((method) => {
    const option = document.createElement("option");
    option.value = method;
    option.textContent = method;
    methodFilter.appendChild(option);
  });

  methodFilter.value = methods.includes(currentValue) ? currentValue : "all";
}

function renderRequests() {
  const query = searchInput.value.trim().toLowerCase();
  const statusValue = statusFilter.value;
  const methodValue = methodFilter.value;
  const domainQuery = domainFilterInput.value.trim().toLowerCase();
  const filtered = capturedRequests.filter((request) =>
    requestMatchesFilters(request, query, statusValue, methodValue, domainQuery)
  );
  const grouped = groupDuplicateRequests(filtered);

  if (
    currentPreview &&
    !grouped.some((request) => request.id === currentPreview.request.id)
  ) {
    closePreview("Preview closed because the selected request is hidden by filters.", false);
  }

  requestList.textContent = "";

  if (!grouped.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = query || domainQuery || statusValue !== "all" || methodValue !== "all"
      ? "No captured JSON responses match your search."
      : hookReady
        ? "No JSON API responses captured yet. Refresh or interact with the current page."
        : "Capture hook is not active on this tab yet. Refresh the page after loading the extension.";
    requestList.appendChild(empty);
    setStatus(hookReady ? "Hook ready. Showing valid JSON responses only." : "Hook not ready for this tab.");
    return;
  }

  grouped.forEach((request) => {
    const item = document.createElement("section");
    item.className = "request";
    if (currentPreview?.request.id === request.id) {
      item.classList.add("active-preview");
    }

    const top = document.createElement("div");
    top.className = "request-top";

    const method = document.createElement("span");
    method.className = "method";
    method.textContent = request.method;

    const url = document.createElement("span");
    url.className = "url";
    url.title = request.url;
    url.textContent = shortenUrl(request.url);

    const status = document.createElement("span");
    status.className = "status-code";
    status.style.color = getStatusClass(request.status);
    status.textContent = request.status || "N/A";

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `x${request.count}`;
    count.title = `${request.count} matching captures`;

    const actions = document.createElement("div");
    actions.className = "actions";

    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.textContent = `${formatBytes(request.sizeBytes)} | ${formatCaptureTime(request.capturedAt)}`;

    const saveButton = document.createElement("button");
    saveButton.className = "primary";
    saveButton.type = "button";
    saveButton.textContent = "Save Clean JSON";
    saveButton.addEventListener("click", () => saveRequest(request.id));

    const previewButton = document.createElement("button");
    previewButton.className = "preview";
    previewButton.type = "button";
    previewButton.textContent = "Preview";
    previewButton.addEventListener("click", () => previewRequest(request));

    const copyButton = document.createElement("button");
    copyButton.className = "secondary";
    copyButton.type = "button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () => copyRequest(request.id));

    top.append(method, url, status);
    if (request.count > 1) {
      top.appendChild(count);
    }
    actions.append(saveButton, previewButton, copyButton);
    item.append(top, meta, actions);
    requestList.appendChild(item);
  });

  setStatus(`Showing ${grouped.length} groups from ${filtered.length} of ${capturedRequests.length} captured JSON responses.`);
}

async function saveRequest(requestId) {
  setStatus("Preparing clean JSON download...");

  const response = await sendMessage({
    type: "SAVE_CLEAN_JSON",
    tabId: activeTabId,
    requestId
  });

  setStatus(response.ok ? "Saved clean JSON file." : response.error);
}

async function exportAllRequests() {
  if (!capturedRequests.length) {
    setStatus("No captured JSON responses to export as ZIP.");
    return;
  }

  setStatus("Preparing ZIP export...");

  const response = await sendMessage({
    type: "GET_ALL_CLEAN_JSON_ENTRIES_FOR_ZIP",
    tabId: activeTabId
  });

  if (!response.ok) {
    setStatus(response.error || "Unable to export captured JSON as ZIP.");
    return;
  }

  const zipBlob = createZipBlob(response.entries);
  downloadBlob(zipBlob, response.filename);
  setStatus(`Exported ${response.entries.length} JSON responses as ZIP.`);
}

async function getCleanJson(requestId) {
  return sendMessage({
    type: "GET_CLEAN_JSON_FOR_COPY",
    tabId: activeTabId,
    requestId
  });
}

async function getResponsePreview(requestId) {
  return sendMessage({
    type: "GET_RESPONSE_PREVIEW",
    tabId: activeTabId,
    requestId
  });
}

async function previewRequest(request) {
  if (currentPreview?.request.id === request.id) {
    closePreview();
    return;
  }

  setStatus("Loading JSON preview...");

  const response = await getResponsePreview(request.id);

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  currentPreview = {
    request,
    rawJson: response.rawJson,
    cleanJson: response.cleanJson
  };
  previewMode = "clean";
  previewMatchCount = 0;
  activePreviewMatchIndex = 0;
  previewTitle.textContent = shortenUrl(request.url);
  previewTitle.title = request.url;
  setPreviewContent(currentPreview.cleanJson);
  previewModeButton.textContent = "Raw";
  previewSearchInput.value = "";
  previewPanel.style.display = "block";
  setStatus("Previewing cleaned JSON.");
  renderRequests();
}

function togglePreviewMode() {
  if (!currentPreview) {
    return;
  }

  previewMode = previewMode === "clean" ? "raw" : "clean";
  setPreviewContent(previewMode === "clean"
    ? currentPreview.cleanJson
    : currentPreview.rawJson);
  previewModeButton.textContent = previewMode === "clean" ? "Raw" : "Clean";
  setStatus(previewMode === "clean" ? "Previewing cleaned JSON." : "Previewing raw JSON.");
}

function closePreview(statusMessage = "Preview closed.", shouldRender = true) {
  previewPanel.style.display = "none";
  previewTitle.textContent = "JSON Preview";
  previewTitle.removeAttribute("title");
  previewContent.textContent = "";
  previewSearchInput.value = "";
  currentPreview = null;
  previewMode = "clean";
  previewMatchCount = 0;
  activePreviewMatchIndex = 0;
  previewModeButton.textContent = "Raw";
  previewSearchStatus.textContent = "No search term.";
  setStatus(statusMessage);
  if (shouldRender) {
    renderRequests();
  }
}

async function clearRequests() {
  if (!activeTabId) {
    return;
  }

  const response = await sendMessage({
    type: "CLEAR_CAPTURED_REQUESTS",
    tabId: activeTabId
  });

  if (!response.ok) {
    setStatus(response.error || "Unable to clear captured responses.");
    return;
  }

  capturedRequests = [];
  closePreview();
  renderRequests();
  setStatus("Cleared captured responses for this tab.");
}

async function copyRequest(requestId) {
  setStatus("Copying clean JSON...");

  const response = await getCleanJson(requestId);

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  try {
    await navigator.clipboard.writeText(response.json);
    setStatus("Copied clean JSON to clipboard.");
  } catch (_error) {
    setStatus("Clipboard access failed. Try Save Clean JSON instead.");
  }
}

async function loadRequests() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id;

  if (!activeTabId) {
    requestList.innerHTML = '<div class="status">No active tab found.</div>';
    return;
  }

  const [response, storedSearch] = await Promise.all([
    sendMessage({
      type: "GET_CAPTURED_REQUESTS",
      tabId: activeTabId
    }),
    chrome.storage.local.get([SEARCH_STORAGE_KEY, DEFAULT_SEARCH_STORAGE_KEY])
  ]);

  hookReady = Boolean(response.hookReady);
  captureEnabled = response.captureEnabled !== false;
  capturedRequests = response.requests || [];
  updateMethodOptions();
  captureToggleButton.textContent = captureEnabled ? "Pause Capture" : "Resume Capture";
  searchInput.value =
    storedSearch[SEARCH_STORAGE_KEY] || storedSearch[DEFAULT_SEARCH_STORAGE_KEY] || "";
  renderRequests();
}

async function toggleCapture() {
  captureEnabled = !captureEnabled;
  captureToggleButton.textContent = captureEnabled ? "Pause Capture" : "Resume Capture";

  const response = await sendMessage({
    type: "SET_CAPTURE_ENABLED",
    enabled: captureEnabled
  });

  if (!response.ok) {
    captureEnabled = !captureEnabled;
    captureToggleButton.textContent = captureEnabled ? "Pause Capture" : "Resume Capture";
    setStatus(response.error || "Unable to update capture setting.");
    return;
  }

  setStatus(captureEnabled ? "Capture resumed." : "Capture paused.");
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function saveCurrentSearch() {
  const value = searchInput.value.trim();
  await saveDefaultSearchText(value);
  setStatus(value ? `Saved search: ${value}` : "Saved empty search.");
}

searchInput.addEventListener("input", () => {
  saveSearchText(searchInput.value.trim());
  renderRequests();
});
saveSearchButton.addEventListener("click", saveCurrentSearch);
statusFilter.addEventListener("change", renderRequests);
methodFilter.addEventListener("change", renderRequests);
domainFilterInput.addEventListener("input", renderRequests);
closePreviewButton.addEventListener("click", closePreview);
clearButton.addEventListener("click", clearRequests);
exportAllButton.addEventListener("click", exportAllRequests);
captureToggleButton.addEventListener("click", toggleCapture);
optionsButton.addEventListener("click", openOptions);
previewModeButton.addEventListener("click", togglePreviewMode);
previewSearchInput.addEventListener("input", () => {
  if (!currentPreview) {
    return;
  }

  activePreviewMatchIndex = 0;
  setPreviewContent(getCurrentPreviewText());
});
previousMatchButton.addEventListener("click", () => movePreviewMatch(-1));
nextMatchButton.addEventListener("click", () => movePreviewMatch(1));
document.addEventListener("DOMContentLoaded", loadRequests);
