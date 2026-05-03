// Shared helpers for validating, cleaning, and formatting captured JSON.

function safeParseJson(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function shouldDropKey(key) {
  const normalized = String(key).toLowerCase();
  const noisyKeys = new Set([
    "headers",
    "cookie",
    "cookies",
    "metadata",
    "meta",
    "config",
    "request",
    "requestinfo",
    "request_info",
    "xhr",
    "http",
    "rawheaders"
  ]);

  return noisyKeys.has(normalized);
}

function cleanJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(cleanJsonValue);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const cleaned = {};
  Object.entries(value).forEach(([key, childValue]) => {
    if (!shouldDropKey(key)) {
      cleaned[key] = cleanJsonValue(childValue);
    }
  });

  return cleaned;
}

function stringifyCleanJson(rawBody) {
  const parsed = typeof rawBody === "string" ? safeParseJson(rawBody) : rawBody;

  if (parsed === null) {
    return null;
  }

  return JSON.stringify(cleanJsonValue(parsed), null, 2);
}

function createDownloadFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `api-response-${timestamp}.json`;
}
