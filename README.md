# GHL Call Log

A local Google Chrome Manifest V3 extension for logging GoHighLevel calls and direct-message outreach as structured data entries.

The extension runs entirely in the browser. It uses `chrome.storage.local` and does not require external servers, a database, GoHighLevel API permissions, or AI services.

## Features

- Floating outreach logger inside GoHighLevel with separate call and DM flows
- `Picked Up` and `No Answer` call tracking
- DM channel, sent message, and outreach outcome tracking
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

When a conversation is open in GoHighLevel, the content script detects the lead name and displays a floating logger. The existing `Picked Up` and `No Answer` actions continue to store call records. `Log DM` opens a separate flow that records channel, message, and outcome (`Sent`, `Replied`, `Qualified`, or `Booked`) as a DM record.

The call logger captures:

- Lead name
- Pickup outcome
- Call datetime
- Call duration when a visible media duration is found

### Manual entries

The popup supports a Call/DM selector. Call entries retain the existing progressive stages:

1. Lead information: name, email, phone, lead timezone, and a required source selected from the fixed list
2. Phone: pickup outcome, call datetime, duration, or last text message for no-answer calls
3. Qualification: the lead’s open-text answer to “What are you looking for?”, and disqualified status/reason
4. Call details: talk time, client type, and objection checkboxes with optional notes
5. Pitch: No / Low ticket self close / High ticket booking (High ticket also asks for closer name and appointment date/time)
6. Notes

The form hides stages that do not apply. For example, qualification is not shown until a lead picks up, and call details/pitch are not shown for disqualified leads. The DM flow records channel, outcome, date/time, and message independently of call fields.

## Storage

The extension stores data in Chrome local storage.

### `entries`

The primary unified collection. Each record has a stable `id` and may include:

- `recordType`
- `fullName` or `name`
- `email`
- `phone`
- `leadTimeZone` (selected GMT offset from `GMT-12` through `GMT+14`)
- `source` (`GA Summit Sept Form`, `Inbound`, `Elective declined`, `Elective approved`, `abandoned aicc`, or `abandoned agents`)
- `intent` (the lead’s answer to “What are you looking for?”)
- `phonePickedUp`
- `callDateTime`
- `callDuration`
- `lastTextMessage`
- `disqualified`
- `disqualificationReason`
- `talkTime`
- `clientType` (selected `9-5` and/or `Business Owner` checkboxes)
- `objections` and `objectionNotes`
- `pitched` (`No`, `Low Ticket`, or `High Ticket`)
- `closer`
- `appointmentDate`
- `notes`
- `createdAt`

The older `callLogs` and `manualEntries` keys are maintained as compatibility mirrors for existing data and content-script behavior.

The popup does not compute outcome rates or summaries; the XLSX export includes a formula-driven Analysis sheet for the call funnel and breakdowns by lead timezone.

### Drafts

`conversationDraft` stores unfinished form data so closing the popup does not lose work. Drafts are removed after saving, clearing, or cancelling.

## Export

Use **Export XLSX** to download the unified `entries` collection as a local Excel workbook. The `Analysis` sheet summarizes the call funnel and compares results by recorded lead timezone. Rates show their denominator, stay blank when there is no eligible data, and should be interpreted with sample size in mind. Only timezones present in the export are listed. The `Entries` sheet contains the underlying data, typed date/time values, objection flags, and filterable headers. Analysis formulas recalculate when entries are edited in Excel.

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
