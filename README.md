# One-Click Clean JSON Saver

A lightweight Chrome Extension built with Manifest V3 that captures JSON API responses from webpages and lets you save a cleaned, formatted JSON file with one click.

## Features

- Captures `fetch` and `XMLHttpRequest` API responses
- Stores request URL, HTTP method, status code, and JSON response body
- Shows only valid JSON responses in the popup
- Saves cleaned JSON as `api-response-{timestamp}.json`
- Copies cleaned JSON to the clipboard
- Includes popup search/filter
- Keeps only the latest 50 captured responses per tab
- Runs completely locally in the browser with no backend server

## File Structure

```text
manifest.json
background.js
content.js
pageHook.js
popup.html
popup.js
utils.js
README.md
```

## How To Load In Chrome

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this extension folder.
6. Open a normal webpage and refresh it.
7. Trigger API calls on the page.
8. Click the extension icon to view captured JSON responses.

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
7. Click **Save Clean JSON** to download the formatted response.

## How It Works

Chrome content scripts normally run in an isolated JavaScript environment, so they cannot directly override a webpage's own `fetch` and `XMLHttpRequest` functions.

This extension uses two scripts:

- `pageHook.js` runs in the page context and patches `fetch` and `XMLHttpRequest`.
- `content.js` runs as the extension bridge and forwards captured responses to the background service worker.

The background service worker stores valid JSON responses per tab. The popup asks the background worker for the current tab's captured responses and provides save/copy actions.

## Clean JSON Logic

Before saving, the response body is parsed safely and cleaned recursively.

The cleaner removes common noisy fields such as:

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

The final JSON is formatted with 2-space indentation.

## Permissions Used

- `activeTab`: access the current tab when the user interacts with the extension
- `tabs`: identify the active tab for popup lookups
- `downloads`: save cleaned JSON files
- `storage`: reserved for extension storage needs
- `<all_urls>` host permission: allow injection on webpages so API calls can be captured

## Notes

- The extension captures API calls made by the webpage, not direct browser address-bar navigations to JSON URLs.
- Chrome internal pages such as `chrome://extensions` cannot be captured.
- Some pages with very strict security policies may limit script patching.
- Opaque or streaming responses may not be readable by the extension.

## GitHub Push

To push this project to GitHub:

```bash
git init
git add .
git commit -m "Initial Chrome extension"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub account and repository name.
