# Setting Tracker

A Chrome extension for tracking cold-call outcomes directly in GoHighLevel, with a standalone tracker page as an alternative.

## Use

Load this folder as an unpacked extension (chrome://extensions > Developer mode > Load unpacked). On GoHighLevel pages, use the **Tracker** tab in the bottom-right panel to open the dashboard. Use **−** to minimize the panel to an **Open tracker** button, which restores it; drag the panel (title bar or empty space) or the button to move the widget around the page. Choose an outcome button to immediately log a completed call; the lead name and page URL are filled from the open conversation.

- Choose **No answer**, **Didn't pitch**, **Didn't book**, or **Booked** to immediately add a completed call to the history. These outcomes are mutually exclusive; **Didn't pitch** means the lead picked up but wasn't pitched, and **Didn't book** means the lead was pitched but didn't book. Totals show dials, picked up, each negative outcome, and booked.
- Keyboard shortcuts: **N** logs no answer, **P** logs didnt pitch, and **B** logs didnt book. On GoHighLevel they work anywhere on the page (whether the panel is on the Tracker or Messages tab, or minimized) except while you're typing in a field such as the message composer; on the standalone page they work whenever you're not typing in a field. Each shortcut immediately creates a completed call; use the **Booked** button for successful bookings. **H** highlights (or un-highlights) the most recent call for review; highlighted calls show in amber with a ★, each entry has a ☆ review button, **Review only** filters the history to highlighted calls, and **Booked only** filters it to booked calls (the two can be combined) for the selected date.
- After **Didn't pitch** or **Didn't book**, a **Why?** box appears with the cursor in it: type a reason and press **Enter** to save it with the call, or press **Esc** / **Skip** to leave it blank. The reason shows in the history.
- Outreach history and **Today's totals** are for calls only. Totals show only outbound dials, picked up, the three negative outcomes, and booked; custom call metrics remain available in entry editing but are not shown in totals. Calls show a pickup rate. To manage custom call metrics, edit an entry and expand **Manage call metrics**. Outreach entries can be edited or deleted. On first load after this change, existing DM/email tracking entries and their custom metrics are permanently deleted, and old calls are converted (booked → booked; pitched → didnt book; picked up or didn't proceed → didnt pitch).

When a GoHighLevel contact is opened, the extension automatically adds **Klint Lee** as a follower: it opens the contact's followers menu, searches for the name, ticks the checkbox if it isn't already ticked, and closes the menu (it never unticks an existing follower). To use a different name, change `FOLLOWER_NAME` in [scripts/auto-follow.js](scripts/auto-follow.js).

Tracker data is stored in the extension page's localStorage and synchronized across open tracker windows. Concurrent changes to different calls are merged so one window does not overwrite another's updates. You can also open [tracker/index.html](tracker/index.html) in a browser to use the standalone tracker.

## Message suggestions extension

The **Messages** tab keeps the existing four suggestions (Follow-up, Standard, Certification form, Build It Launch It). Clicking one pastes it, with the lead's first name filled in, into the conversation composer. Click **+ Add message** to save your own (use {name} for the lead's first name). Messages are saved in the extension's storage.
