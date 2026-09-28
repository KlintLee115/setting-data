# GHL Call Log

A local Google Chrome Manifest V3 extension for logging GoHighLevel conversations and call outcomes as structured data entries.

The extension runs entirely in the browser. It uses `chrome.storage.local` and does not require external servers, a database, GoHighLevel API permissions, or AI services.

## Features

- Floating call logger inside GoHighLevel
- `Picked Up` and `No Answer` call tracking
- Call datetime and call duration tracking
- Manual lead-entry form with progressive workflow stages
- Draft persistence when the popup is closed
- Edit and delete entries
- Duplicate-call warning based on normalized lead name and call time
- CSV export and import

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Open a matching GoHighLevel page and refresh it.
6. Click the extension icon to open the dashboard.

The extension matches:

- `https://app.gohighlevel.com/*`
- `https://*.gohighlevel.com/*`
- `https://*.msgsndr.com/*`

After changing extension files, click **Reload** on the extension page and refresh the GoHighLevel tab.

## Workflow

### GHL call logging

When a conversation is open in GoHighLevel, the content script detects the lead name and displays a floating logger. Selecting `Picked Up` or `No Answer` stores a call record locally.

The call logger captures:

- Lead name
- Pickup outcome
- Call datetime
- Call duration when a visible media duration is found

### Manual entries

The popup supports these progressive stages:

1. Lead information: name, email, phone
2. Phone: pickup outcome, call datetime, duration, or last text message for no-answer calls
3. Qualification: disqualified status and reason
4. Call details: talk time, talk-to-listen ratio, client type, and objection checkboxes with optional notes
5. Pitch: No / Low ticket self close / High ticket booking (High ticket also asks for closer name and appointment date/time)
6. Notes

The form hides stages that do not apply. For example, qualification is not shown until a lead picks up, and call details/pitch are not shown for disqualified leads.

## Storage

The extension stores data in Chrome local storage.

### `entries`

The primary unified collection. Each record has a stable `id` and may include:

- `recordType`
- `fullName` or `name`
- `email`
- `phone`
- `phonePickedUp`
- `callDateTime`
- `callDuration`
- `lastTextMessage`
- `disqualified`
- `disqualificationReason`
- `talkTime`
- `talkToListenRatio`
- `clientType`
- `objections` and `objectionNotes`
- `pitched` (`No`, `Low Ticket`, or `High Ticket`)
- `closer`
- `appointmentDate`
- `notes`
- `createdAt`

The older `callLogs` and `manualEntries` keys are maintained as compatibility mirrors for existing data and content-script behavior.

This extension intentionally does not compute outcome rates or summaries — export to CSV and analyze in Excel/Google Sheets instead.

### Drafts

`conversationDraft` stores unfinished form data so closing the popup does not lose work. Drafts are removed after saving, clearing, or cancelling.

## Backup and Restore

Use **Export CSV** to download the unified `entries` collection as a local CSV file, which opens in Excel and can be imported into Google Sheets.

Use **Import CSV** to load a previously exported CSV file. The file must contain the exported header row. Import replaces the current unified collection after validation and reloads the popup.

Keep exported files somewhere secure because they may contain names, phone numbers, email addresses, and notes.

## Privacy

- No external server calls
- No GoHighLevel API calls
- No AI processing
- No analytics or telemetry
- Data stays in Chrome extension storage on the local browser profile

Anyone with access to the Chrome profile may be able to access the extension data. Use CSV exports carefully because they contain potentially sensitive lead information.

## Project Files

- `manifest.json`: Chrome extension configuration
- `popup.html`: Dashboard and data-entry interface
- `scripts/content.js`: GoHighLevel page detection, floating logger, and local call persistence
- `scripts/popup.js`: Popup state, form handling, and editing
- `scripts/popup-data-transfer.js`: CSV export and import
- `scripts/popup-settings.js`: Local date and time helpers
- `scripts/entry-model.js`: Entry status normalization and record shaping
- `scripts/objection-options.js`: Shared objection checkbox options used by the call logger and popup form
- `scripts/popup-storage.js`: Chrome storage access, migration, and draft persistence
- `scripts/entry-view.js`: Entry table rendering and row actions
- `scripts/timezone.js`: Local date/time conversion and formatting
- `tests/`: Local date/time, entry-model, and content-script behavior tests

## Development

Install the development dependency and run the full check before opening a pull request:

```powershell
npm ci
npm run check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local workflow and manual extension smoke test.

The browser extension currently loads JavaScript from `scripts/`; those files are the runtime source of truth. TypeScript in `src/` is a checked migration and is not loaded by Chrome yet. Keep equivalent behavior aligned when changing the typed modules. `npm run check` runs the test suite and TypeScript check.
