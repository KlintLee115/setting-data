# Setting Tracker

A Chrome extension for tracking cold-call outcomes directly in GoHighLevel, with a standalone tracker page as an alternative.

## Use

Load this folder as an unpacked extension (chrome://extensions > Developer mode > Load unpacked). On GoHighLevel pages, use the **Tracker** tab in the bottom-right panel to open the dashboard. Use **−** to minimize the panel to an **Open tracker** button, which restores it; drag the panel (title bar or empty space) or the button to move the widget around the page. **+ New call** starts the same call-entry flow and automatically fills the lead name from the open conversation; you can still edit the name manually.

- **+ New call**, **+ New DM**, and **+ New email** start separate outreach entries (editable date/time and optional lead name). DMs and emails have a **Message sent** text field and a **something happened before the text** metric (with optional context); emails also have an optional subject. When opened on a GoHighLevel lead, the lead name and page URL are saved with the entry; saved links are available from the outreach history.
- Call outcomes include pickup, no answer, didn't proceed (with reasons and notes), something happened before the call (with optional context), pitched, and booked.
- Daily totals, the outreach history, and **Manage metrics** are separate per channel: use the **Calls / DMs / Emails** selector above the totals to switch. Custom metrics you add only apply to the selected channel, and calls also show a pickup rate. Outreach entries can be edited or deleted.

Tracker data is stored in the extension page's localStorage and synchronized across open tracker windows. Concurrent changes to different calls are merged so one window does not overwrite another's updates. You can also open [tracker/index.html](tracker/index.html) in a browser to use the standalone tracker.

## Message suggestions extension

The **Messages** tab keeps the existing four suggestions (Follow-up, Standard, Certification form, Build It Launch It). Clicking one pastes it, with the lead's first name filled in, into the conversation composer. Click **+ Add message** to save your own (use {name} for the lead's first name). Messages are saved in the extension's storage.
