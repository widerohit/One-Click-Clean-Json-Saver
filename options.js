const DEFAULT_SETTINGS = {
  captureEnabled: true,
  maxRequests: 50,
  defaultSearchText: "",
  cleanFields: "headers,cookie,cookies,metadata,meta,config,request,requestInfo,request_info,xhr,http,rawHeaders"
};

const form = document.getElementById("optionsForm");
const captureEnabled = document.getElementById("captureEnabled");
const maxRequests = document.getElementById("maxRequests");
const defaultSearchText = document.getElementById("defaultSearchText");
const cleanFields = document.getElementById("cleanFields");
const statusText = document.getElementById("status");

function normalizeMaxRequests(value) {
  return Math.min(Math.max(Number(value) || DEFAULT_SETTINGS.maxRequests, 10), 200);
}

async function loadOptions() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);

  captureEnabled.checked = Boolean(settings.captureEnabled);
  maxRequests.value = normalizeMaxRequests(settings.maxRequests);
  defaultSearchText.value = settings.defaultSearchText || "";
  cleanFields.value = settings.cleanFields || DEFAULT_SETTINGS.cleanFields;
}

async function saveOptions(event) {
  event.preventDefault();

  await chrome.storage.local.set({
    captureEnabled: captureEnabled.checked,
    maxRequests: normalizeMaxRequests(maxRequests.value),
    defaultSearchText: defaultSearchText.value.trim(),
    cleanFields: cleanFields.value.trim() || DEFAULT_SETTINGS.cleanFields
  });

  statusText.textContent = "Saved.";
  setTimeout(() => {
    statusText.textContent = "";
  }, 1800);
}

form.addEventListener("submit", saveOptions);
document.addEventListener("DOMContentLoaded", loadOptions);
