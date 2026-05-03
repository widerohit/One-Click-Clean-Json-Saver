const requestList = document.getElementById("requestList");
const searchInput = document.getElementById("searchInput");
const footerStatus = document.getElementById("footerStatus");

let activeTabId = null;
let capturedRequests = [];
let hookReady = false;

function shortenUrl(url) {
  try {
    const parsed = new URL(url, "https://example.invalid");
    return `${parsed.hostname}${parsed.pathname}`;
  } catch (_error) {
    return url;
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

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function setStatus(text) {
  footerStatus.textContent = text;
}

function renderRequests() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = capturedRequests.filter((request) =>
    request.url.toLowerCase().includes(query)
  );

  requestList.textContent = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = query
      ? "No captured JSON responses match your search."
      : hookReady
        ? "No JSON API responses captured yet. Refresh or interact with the current page."
        : "Capture hook is not active on this tab yet. Refresh the page after loading the extension.";
    requestList.appendChild(empty);
    setStatus(hookReady ? "Hook ready. Showing valid JSON responses only." : "Hook not ready for this tab.");
    return;
  }

  filtered.forEach((request) => {
    const item = document.createElement("section");
    item.className = "request";

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

    const actions = document.createElement("div");
    actions.className = "actions";

    const saveButton = document.createElement("button");
    saveButton.className = "primary";
    saveButton.type = "button";
    saveButton.textContent = "Save Clean JSON";
    saveButton.addEventListener("click", () => saveRequest(request.id));

    const copyButton = document.createElement("button");
    copyButton.className = "secondary";
    copyButton.type = "button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () => copyRequest(request.id));

    top.append(method, url, status);
    actions.append(saveButton, copyButton);
    item.append(top, actions);
    requestList.appendChild(item);
  });

  setStatus(`Showing ${filtered.length} of ${capturedRequests.length} captured JSON responses.`);
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

async function copyRequest(requestId) {
  setStatus("Copying clean JSON...");

  const response = await sendMessage({
    type: "GET_CLEAN_JSON_FOR_COPY",
    tabId: activeTabId,
    requestId
  });

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

  const response = await sendMessage({
    type: "GET_CAPTURED_REQUESTS",
    tabId: activeTabId
  });

  hookReady = Boolean(response.hookReady);
  capturedRequests = response.requests || [];
  renderRequests();
}

searchInput.addEventListener("input", renderRequests);
document.addEventListener("DOMContentLoaded", loadRequests);
