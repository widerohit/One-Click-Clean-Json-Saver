# One-Click Clean JSON Saver

A lightweight Manifest V3 Chrome extension that captures JSON API responses from webpages and lets users preview, copy, save, or export clean formatted JSON.

Everything runs locally in the browser. No backend server is used.

## Features

- Captures `fetch` and `XMLHttpRequest` JSON API responses
- Stores URL, HTTP method, status code, response size, capture time, and response body
- Shows only valid JSON responses in the popup
- Search by endpoint URL or JSON response content
- Filter by HTTP status group: `2xx`, `3xx`, `4xx`, `5xx`
- Filter by HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, etc.
- Filter by domain
- Preview cleaned JSON before saving
- Toggle preview between **Clean** and **Raw** JSON
- Copy cleaned JSON to clipboard
- Save one cleaned JSON response
- Export all captured responses as a ZIP file with separate `.json` files
- Clear captured responses for the current tab
- Pause and resume capture
- Remember popup search text
- Group duplicate API calls only when method, status, URL, and JSON content match
- Options page for capture settings and cleaning rules
- Configurable max stored responses per tab
- Extension icons included
- Privacy policy included

## File Structure

```text
manifest.json
background.js
content.js
pageHook.js
popup.html
popup.js
options.html
options.js
utils.js
PRIVACY.md
README.md
icons/
```

## Install From GitHub

1. Click the green **Code** button on GitHub.
2. Click **Download ZIP**.
3. Extract the ZIP file.
4. Open Chrome and go to `chrome://extensions`.
5. Turn on **Developer mode**.
6. Click **Load unpacked**.
7. Select the extracted extension folder.

You can also clone the repo:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

Then load the cloned folder with **Load unpacked**.

## Quick Test

1. Load the extension in Chrome.
2. Open `https://example.com`.
3. Open DevTools Console.
4. Run:

```js
fetch("https://jsonplaceholder.typicode.com/posts/1")
  .then((response) => response.json())
  .then(console.log);
```

5. Open the extension popup.
6. You should see the `posts/1` JSON request.
7. Click **Preview** to inspect cleaned JSON.
8. Click **Raw** to compare the original response.
9. Click **Save Clean JSON** to download one response.
10. Click **Export ZIP** to download all captured responses.

## Usage

1. Load the extension in Chrome.
2. Open any normal website that makes API calls.
3. Refresh the webpage after loading the extension.
4. Use the website normally so it triggers `fetch` or XHR API requests.
5. Click the extension icon.
6. Captured JSON API responses will appear in the popup.

From the popup, you can:

- Use the main search box to search by API URL or JSON response content.
- Click **Save** beside the search box to remember that search text.
- Filter requests by status, method, or domain.
- Click **Preview** to view the cleaned JSON.
- Use **Raw** to switch between raw JSON and cleaned JSON.
- Use **Search inside JSON** to find keys or values inside the preview.
- Use the arrow buttons to move between JSON search matches.
- Click **Copy** to copy cleaned JSON.
- Click **Save Clean JSON** to download one response.
- Click **Export ZIP** to download all captured responses as separate JSON files in one ZIP.
- Click **Clear** to remove captured responses for the current tab.
- Click **Pause Capture** when you do not want new responses captured.
- Click **Options** to change max stored responses, default search text, and cleaning rules.

The extension icon shows a red badge count when JSON responses are captured on the current tab.

## How Grouping Works

Duplicate API calls are grouped only when all of these match:

```text
HTTP method + status code + full URL + JSON content
```

Example grouped as `x2`:

```text
GET /users 200 -> { "name": "Alex" }
GET /users 200 -> { "name": "Alex" }
```

Example shown as separate items:

```text
GET /users 200 -> { "name": "Alex" }
GET /users 200 -> { "name": "Sam" }
```

Actions like Preview, Copy, and Save use the latest response in the group.

## Options

Open the popup and click **Options**, or right-click the extension icon and choose **Options**.

You can configure:

- Capture enabled or paused
- Max responses stored per tab
- Default search text
- Comma-separated fields removed during JSON cleaning

## How It Works

Chrome content scripts normally run in an isolated JavaScript environment, so they cannot directly override a webpage's own `fetch` and `XMLHttpRequest` functions.

This extension uses two scripts:

- `pageHook.js` runs in the page context and patches `fetch` and `XMLHttpRequest`.
- `content.js` runs as the extension bridge and forwards captured responses to the background service worker.

The background service worker validates JSON, stores captured responses per tab, applies settings, and prepares clean JSON for preview, copy, save, and ZIP export.

## Clean JSON Logic

Before saving or exporting, the response body is parsed safely and cleaned recursively.

By default, the cleaner removes common noisy fields such as:

- `headers`
- `cookie`
- `cookies`
- `metadata`
- `meta`
- `config`
- `request`
- `request_info`
- `xhr`
- `http`
- `rawHeaders`

You can change the removed fields from the Options page.

The final JSON is formatted with 2-space indentation.

## Permissions Used

- `activeTab`: access the current tab when the user interacts with the extension
- `tabs`: identify the active tab for popup lookups
- `downloads`: save cleaned JSON files and ZIP exports
- `storage`: store local settings and saved search text
- `<all_urls>` host permission: inject scripts into webpages so `fetch` and XHR responses can be captured

## Privacy

See [PRIVACY.md](PRIVACY.md).

Short version: captured API responses stay local in the browser. The extension does not send captured data to any backend server.

## Notes

- The extension captures API calls made by the webpage, not direct browser address-bar navigations to JSON URLs.
- Chrome internal pages such as `chrome://extensions` cannot be captured.
- Some pages with very strict security policies may limit script patching.
- Opaque or streaming responses may not be readable by the extension.
- Captured responses are stored in memory and cleared when the tab is closed or when the user clicks **Clear**.

## GitHub Push

```bash
git add .
git commit -m "Update production-ready Chrome extension"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

If the remote already exists, use:

```bash
git push
```
