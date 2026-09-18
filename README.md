# GHL Call Log

A local Google Chrome Manifest V3 extension for tracking GoHighLevel conversations, call outcomes, lead progress, and daily pickup performance.

The extension runs entirely in the browser. It uses `chrome.storage.local` and does not require external servers, a database, GoHighLevel API permissions, or AI services.

## Features

- Floating call logger inside GoHighLevel
- `Picked Up` and `No Answer` call tracking
- Call datetime and call duration tracking
- Manual lead-entry form with progressive workflow stages
- Call-record JSON import from the GoHighLevel call logger
- Draft persistence when the popup is closed
- Edit and delete entries
- Duplicate-call warning based on normalized lead name and call time
- Daily summary metrics
- Hourly pickup-rate tracker in Mountain Time
- JSON backup and restore

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
4. Pitch: whether the lead was pitched
5. Setting: whether an appointment was set, closer, and appointment datetime
6. Conversation outcome: Money, Partner, Timing, or Had to go when a non-disqualified lead leaves after a failed pitch or setting outcome
7. Notes

The form hides stages that do not apply. For example, qualification is not shown until a lead picks up, and pitch is not shown for disqualified leads.

## Daily Reporting

The dashboard lets you select a date and reports:

- Calls
- Pick Ups
- Disqualified
- Pitches
- Appointments Set
- No Answers
- Money
- Partner
- Timing
- Had To Go
- Pitch Rate
- Set Rate
- Average Call Duration

### Pickup rate

For each Mountain Time hour:

```text
Pickup rate = Pick Ups / Calls * 100
```

Calls count only when an explicit phone outcome exists. A lead called twice on the same day counts as two calls. If one call is unanswered and the second is answered, the result is two calls and one pickup.

### Conversion rates

Pitch rate is calculated from non-disqualified records:

```text
Pitch rate = Pitched / Non-disqualified records * 100
```

Set rate is calculated from the same non-disqualified group:

```text
Set rate = Appointments Set / Non-disqualified records * 100
```

The frontend formats timestamps in `America/Denver` and displays `MDT` or `MST` automatically.

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
- `pitched`
- `wasSet`
- `closer`
- `appointmentDate`
- `leaveReason` (`Money`, `Partner`, `Timing`, or `Had to go`; older `Objection` values count as `Money`)
- `notes`
- `createdAt`

The older `callLogs` and `manualEntries` keys are maintained as compatibility mirrors for existing data and content-script behavior.

### Drafts

`conversationDraft` stores unfinished form data so closing the popup does not lose work. Drafts are removed after saving, clearing, or cancelling.

## Backup and Restore

Use **Backup JSON** to download the unified `entries` collection as a local JSON file.

Use **Restore JSON** to load a previously created backup. The file must contain a JSON array of entry objects. Restore replaces the current unified collection after validation and reloads the popup.

Keep backups somewhere secure because they may contain names, phone numbers, email addresses, and notes.

## Privacy

- No external server calls
- No GoHighLevel API calls
- No AI processing
- No analytics or telemetry
- Data stays in Chrome extension storage on the local browser profile

Anyone with access to the Chrome profile may be able to access the extension data. Use JSON backups carefully because they contain potentially sensitive lead information.

## Project Files

- `manifest.json`: Chrome extension configuration
- `popup.html`: Dashboard and data-entry interface
- `scripts/content.js`: GoHighLevel page detection, floating logger, and local call persistence
- `scripts/popup.js`: Popup state, form handling, reporting, and editing
- `scripts/popup-data-transfer.js`: Backup, restore, and call-record JSON import
- `scripts/popup-settings.js`: Reporting and appointment timezone settings
- `scripts/appointment-queue.js`: Upcoming appointment filtering, labels, and ordering
- `scripts/entry-model.js`: Entry status normalization and record shaping
- `scripts/outcome-model.js`: Conversation outcome codes (Money, Partner, Timing, Had to go)
- `scripts/popup-storage.js`: Chrome storage access, migration, and draft persistence
- `scripts/queue-view.js`: Appointment queue DOM rendering and follow-up actions
- `scripts/entry-view.js`: Entry table rendering and row actions
- `scripts/summary-model.js`: Daily and hourly reporting calculations
- `scripts/dom-utils.js`: Safe reusable DOM construction helpers
- `scripts/timezone.js`: Timezone conversion and date formatting
- `tests/`: Timezone, queue, entry-model, and content-script behavior tests

Run the extension tests from this directory:

```powershell
node --test tests/*.test.js
```

The TypeScript migration is staged in `src/`. The typed core currently covers entry models, outcomes, timezone utilities, appointment queues, and popup storage. Run `npm run typecheck` to validate it; the live extension continues to use the existing scripts until the browser bundle is wired.
