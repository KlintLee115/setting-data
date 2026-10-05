# Setting Tracker

A Chrome extension for tracking cold-call outcomes directly in GoHighLevel, with a standalone tracker page as an alternative.

## Use

Load this folder as an unpacked extension (chrome://extensions > Developer mode > Load unpacked). On GoHighLevel pages, use the **Tracker** tab in the bottom-right panel to open the dashboard. **+ New call** starts the same call-entry flow and automatically fills the lead name from the open conversation; you can still edit the name manually.

- **+ New call** adds a dial and starts a call entry (editable call date/time and optional lead name).
- Toggle the result: pickup, no answer, qualified, disqualified (asks for a reason), pitched, booked.
- Totals and pickup rate are computed from the call list; calls can be edited or deleted.

Tracker data is stored in the extension page's localStorage. You can also open [tracker/index.html](tracker/index.html) in a browser to use the standalone tracker.

## Message suggestions extension

The **Messages** tab keeps the existing four suggestions (Follow-up, Standard, Certification form, Build It Launch It). Clicking one pastes it, with the lead's first name filled in, into the conversation composer. Click **+ Add message** to save your own (use {name} for the lead's first name). Messages are saved in the extension's storage.
