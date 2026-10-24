# GHL Setting Tracker

A lightweight Chrome extension for logging cold-call outcomes while you work in GoHighLevel (GHL). It also includes quick message suggestions and can automatically add you as a follower on each contact.

## Get started

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this project folder.
4. Refresh your GoHighLevel tab.
5. Use the small panel in the bottom-right corner. Select **Tracker** to open the call log.

You can drag the panel to move it. Select **−** to minimize it; choose **Open tracker** to bring it back.

## Log a call

Choose one outcome as soon as the call ends. Each choice records one completed call:

| Button | Use when |
| --- | --- |
| **No answer** | The lead did not pick up. |
| **Didn't pitch** | The lead picked up, but you didn't pitch. |
| **Didn't book** | You pitched, but did not book an appointment. |
| **Booked** | The call resulted in a booking. |

For **Didn't pitch** and **Didn't book**, a **Why?** box appears. Type a note and press **Enter** to save it, or press **Esc** / choose **Skip** to leave it blank.

The open GHL contact's name and page link are added to the call automatically.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| **N** | Log **No answer**. |
| **P** | Log **Didn't pitch**. |
| **B** | Log **Didn't book**. |
| **H** | Highlight or unhighlight the most recent call for review. |

On GHL, these shortcuts work across the page, even when the tracker panel is minimized or on the **Messages** tab. They are ignored while you type in a field, such as the message composer. On the standalone tracker page, they work when you are not typing in a field.

## Review your calls

- **Today's totals** show outbound dials, picked up, each of the three negative outcomes, and booked calls for the selected date. Use the date picker to view another day.
- Calls without a negative outcome count as booked.
- Use **☆ Review only** to show highlighted calls. Press **H** to highlight the most recent call, or use the review button on any call.
- Use **✓ Booked only** to show booked calls. You can combine it with **Review only** to find highlighted bookings.
- The pickup rate is shown below the totals.

Choose **edit** on a call to change its details or manage custom call metrics. Choose **delete** to remove it.

## Automatically follow contacts

When you open a GHL contact, the extension attempts to add **Klint Lee** as a follower if he is not already assigned. It does not remove existing followers. To use a different name, change `FOLLOWER_NAME` in [scripts/auto-follow.js](scripts/auto-follow.js).

## Message suggestions

Open the **Messages** tab to use the built-in suggestions: Follow-up, Standard, Certification form, and Build It Launch It. Choosing a suggestion fills it into the conversation composer with the contact's first name. Use **+ Add message** to create your own suggestion; use `{name}` where you want the first name inserted.

## Data and upgrading

Call data is stored in the extension's tracker page and synchronized across open tracker windows. Message suggestions are stored in the extension's storage.

The tracker now keeps call records only. If you are upgrading from an older version, old DM/email records and their custom metrics are removed. Legacy call outcomes are converted to the current outcomes: booked calls stay booked, pitched calls become **Didn't book**, and picked-up / didn't-proceed calls become **Didn't pitch**.

To use the tracker without opening GHL, open [tracker/index.html](tracker/index.html) in Chrome.
