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
- Excel workbook export

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

1. Lead information: name, email, phone, lead timezone, and contact history (first touch or contacted before)
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
- `leadTimeZone` (selected GMT offset from `GMT-12` through `GMT+14`)
- `contactHistory` (`First touch` or `Contacted before`)
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

The popup does not compute outcome rates or summaries; the XLSX export includes a formula-driven Analysis sheet for the call funnel and breakdowns by contact history and lead timezone.

### Drafts

`conversationDraft` stores unfinished form data so closing the popup does not lose work. Drafts are removed after saving, clearing, or cancelling.

## Export

Use **Export XLSX** to download the unified `entries` collection as a local Excel workbook. The `Analysis` sheet summarizes the call funnel and compares results by contact history and recorded lead timezone. Rates show their denominator, stay blank when there is no eligible data, and should be interpreted with sample size in mind. Only timezones present in the export are listed. The `Entries` sheet contains the underlying data, typed date/time values, objection flags, and filterable headers. Analysis formulas recalculate when entries are edited in Excel.

Keep exported files somewhere secure because they may contain names, phone numbers, email addresses, and notes.

## Privacy

- No external server calls
- No GoHighLevel API calls
- No AI processing
- No analytics or telemetry
- Data stays in Chrome extension storage on the local browser profile

Anyone with access to the Chrome profile may be able to access the extension data. Handle XLSX exports carefully because they contain potentially sensitive lead information.

## Project Files

- `manifest.json`: Chrome extension configuration
- `popup.html`: Dashboard and data-entry interface
- `scripts/content.js`: GoHighLevel page detection, floating logger, and local call persistence
- `scripts/popup.js`: Popup state, form handling, and editing
- `scripts/popup-data-transfer.js`: XLSX export
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

The browser extension loads JavaScript from `scripts/`. `npm run check` runs the test suite.
