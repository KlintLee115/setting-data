function getLocalDateTimeValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function getTodayAtTime(timeText) {
  const match = timeText.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) {
    return '';
  }
  const date = new Date();
  let hours = Number(match[1]);
  if (match[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${String(hours).padStart(2, '0')}:${match[2]}`;
}

function extractCallDuration(text) {
  const match = text.match(/(?:call completed[\s\S]{0,120}?)?(\d{1,2}:\d{2})\s*\/\s*(\d{1,2}:\d{2})/i);
  return match ? match[2] : '';
}

function extractLeadName(text) {
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
  return /^[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){1,3}$/i.test(firstLine)
    ? firstLine
    : '';
}

function getCallTimestamp(lines, callIndex) {
  const timestampPattern = /^\d{1,2}:\d{2}\s*[AP]M$/i;
  const window = 8;

  for (let offset = 1; offset <= window; offset += 1) {
    const nextIndex = callIndex + offset;
    if (nextIndex < lines.length && timestampPattern.test(lines[nextIndex])) {
      return lines[nextIndex];
    }
  }

  for (let offset = 1; offset <= window; offset += 1) {
    const prevIndex = callIndex - offset;
    if (prevIndex >= 0 && timestampPattern.test(lines[prevIndex])) {
      return lines[prevIndex];
    }
  }

  return '';
}

function hasFollowUpTextAfterCall(lines, callIndex) {
  const timestampPattern = /^\d{1,2}:\d{2}\s*[AP]M$/i;
  const maxLookahead = 12;

  for (let i = callIndex + 1; i < Math.min(lines.length, callIndex + maxLookahead); i += 1) {
    if (!timestampPattern.test(lines[i])) {
      continue;
    }

    for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
      const line = lines[j];
      if (!line || line.toLowerCase() === 'call completed') {
        continue;
      }
      if (line.toLowerCase() === 'kl') {
        const afterKl = lines.slice(j + 1, Math.min(lines.length, j + 6)).join(' ');
        if (afterKl && !/call completed|voicemail|no answer|did not answer|didn't answer/.test(afterKl)) {
          return true;
        }
      }
      if (/^[A-Z][A-Za-z.-]+$/.test(line) && line.toLowerCase() !== 'kl') {
        return false;
      }
    }
  }

  return false;
}

function extractCallRecords(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records = [];
  let previousCallIndex = 0;

  lines.forEach((line, index) => {
    if (line.toLowerCase() !== 'kl' || lines[index + 1]?.toLowerCase() !== 'call completed') {
      return;
    }
    const context = lines.slice(previousCallIndex, index + 5).join(' ');
    const duration = extractCallDuration(lines.slice(index, index + 3).join(' '));
    const followUpTextAfterCall = hasFollowUpTextAfterCall(lines, index);
    const pickedUp = !/\b(no answer|voicemail|did not answer|didn't answer)\b/i.test(context) && !followUpTextAfterCall;
    const callTimestamp = getCallTimestamp(lines, index);

    records.push({
      id: `call-${records.length + 1}`,
      callDateTime: callTimestamp ? getTodayAtTime(callTimestamp) : getLocalDateTimeValue(),
      callDuration: duration,
      phonePickedUp: pickedUp ? 'Yes' : 'No',
      status: pickedUp ? 'Picked Up' : 'No Answer'
    });
    previousCallIndex = index + 2;
  });
  return records;
}

if (typeof module !== 'undefined') {
  module.exports = { extractCallRecords, extractLeadName };
}
