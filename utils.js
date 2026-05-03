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

function getCleanFieldSet(cleanFields) {
  const fallbackFields = [
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
  ];

  const fields = typeof cleanFields === "string" && cleanFields.trim()
    ? cleanFields.split(",")
    : fallbackFields;

  return new Set(
    fields.map((field) => String(field).trim().toLowerCase()).filter(Boolean)
  );
}

function shouldDropKey(key, cleanFields) {
  const normalized = String(key).toLowerCase();
  const noisyKeys = getCleanFieldSet(cleanFields);

  return noisyKeys.has(normalized);
}

function cleanJsonValue(value, cleanFields) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanJsonValue(item, cleanFields));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const cleaned = {};
  Object.entries(value).forEach(([key, childValue]) => {
    if (!shouldDropKey(key, cleanFields)) {
      cleaned[key] = cleanJsonValue(childValue, cleanFields);
    }
  });

  return cleaned;
}

function stringifyCleanJson(rawBody, cleanFields) {
  const parsed = typeof rawBody === "string" ? safeParseJson(rawBody) : rawBody;

  if (parsed === null) {
    return null;
  }

  return JSON.stringify(cleanJsonValue(parsed, cleanFields), null, 2);
}

function createDownloadFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `api-response-${timestamp}.json`;
}

function createExportAllFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `api-responses-${timestamp}.json`;
}

function getByteSize(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function createContentHash(value) {
  const text = typeof value === "string"
    ? stableJsonStringify(safeParseJson(value))
    : stableJsonStringify(value);
  let hash = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}
