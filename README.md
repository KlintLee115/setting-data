# Setting Tracker

A standalone page for tracking cold-call outcomes (no server needed), plus a small Chrome extension for GoHighLevel message suggestions.

## Use

Open [tracker/index.html](tracker/index.html) in a browser (or host the `tracker` folder as a website; in Chrome you can use "Install page as app" for a Windows app window).

- **+ New call** adds a dial and starts a call entry (timestamped, optional lead name).
- Toggle the result: pickup, no answer, qualified, disqualified (asks for a reason), pitched, booked.
- Totals and pickup rate are computed from the call list; calls can be edited or deleted.

Data is stored in the browser's localStorage.

## Message suggestions extension

Load this folder as an unpacked extension (chrome://extensions > Developer mode > Load unpacked). On GoHighLevel pages a small panel appears bottom-right with four buttons (Follow-up, Standard, Certification form, Build It Launch It). Clicking one pastes that message, with the lead's first name filled in, into the conversation composer. Click **+ Add message** to save your own (use {name} for the lead's first name). Messages are saved in the extension's storage.
