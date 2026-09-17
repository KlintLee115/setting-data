function getTodayAtTime(timeText, getDateTimeParts) {
  const match = String(timeText || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return '';
  const today = getDateTimeParts(new Date());
  let hours = Number(match[1]);
  if (match[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
  return `${today.year}-${today.month}-${today.day}T${String(hours).padStart(2, '0')}:${match[2]}`;
}

function extractCallDuration(text) {
  const match = String(text || '').match(/(?:call completed[\s\S]{0,120}?)?(\d{1,2}:\d{2})\s*\/\s*(\d{1,2}:\d{2})/i);
  return match ? match[2] : '';
}

function extractConversationData(text, { extractLeadName, getDateTimeParts, getMountainDateTimeValue, getLocalDateTimeValue }) {
  const data = {};
  const firstLineName = extractLeadName(text);
  const nameMatch = text.match(/(?:hi|hey|hello)\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){1,3})[,!]/i);
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = text.match(/(?:\+?\d[\d().\s-]{7,}\d)/);
  const appointmentMatch = text.match(/(?:appointment|meeting)[^\n]*?(?:at\s+)?(?:Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)?[,]?\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})[^\n]*?(\d{1,2}:\d{2}\s*[AP]M)/i);

  if (firstLineName) data.fullName = firstLineName;
  else if (nameMatch) data.fullName = nameMatch[1].trim();
  if (emailMatch) data.email = emailMatch[0];
  if (phoneMatch) data.phone = phoneMatch[0].replace(/\s+/g, ' ').trim();
  if (appointmentMatch) {
    const parsed = new Date(`${appointmentMatch[1]} ${appointmentMatch[2]}`);
    if (!Number.isNaN(parsed.getTime())) data.appointmentDate = getMountainDateTimeValue(parsed);
  }
  if (/no[- ]?show/i.test(text)) data.status = 'No-show';
  const completedCallMatch = text.match(/call completed[\s\S]{0,120}?(\d{1,2}:\d{2}\s*[AP]M)/i);
  const callDuration = extractCallDuration(text);
  if (callDuration) data.callDuration = callDuration;
  if (/\b(picked up|call completed|spoke with|connected with)\b/i.test(text)) {
    data.phonePickedUp = 'Yes';
    data.callDateTime = completedCallMatch
      ? getTodayAtTime(completedCallMatch[1], getDateTimeParts)
      : getLocalDateTimeValue();
  } else if (/\b(no answer|did not answer|didn't answer|no response|left a voicemail)\b/i.test(text)) {
    data.phonePickedUp = 'No';
    data.callDateTime = getLocalDateTimeValue();
  }
  const leftCall = /\b(left|had to leave|got off)\b[^.\n]{0,80}\b(call|conversation)\b/i.test(text)
    || /\b(call|conversation)\b[^.\n]{0,80}\b(left|had to leave|got off)\b/i.test(text);
  if (leftCall) {
    data.disqualified = data.disqualified || 'No';
    data.pitched = data.pitched || 'No';
    if (/\b(too expensive|can't afford|cannot afford|no budget|price|cost|money)\b/i.test(text)) {
      data.leaveReason = 'Money';
    } else if (/\b(partner|spouse|husband|wife|boyfriend|girlfriend)\b/i.test(text)) {
      data.leaveReason = 'Partner';
    } else if (/\b(not (?:right )?now|maybe later|next (?:week|month)|bad timing|timing)\b/i.test(text)) {
      data.leaveReason = 'Timing';
    } else if (/\b(had to go|have to go|needed to go|gotta go|has to go|leave for)\b/i.test(text)) {
      data.leaveReason = 'Had to go';
    } else if (/\b(objection|concern|hesitant)\b/i.test(text)) {
      data.leaveReason = 'Money';
    }
  }
  if (/\b(disqualified|not qualified|does not qualify)\b/i.test(text)) data.disqualified = 'Yes';
  else if (/\b(qualified|qualifies)\b/i.test(text)) data.disqualified = 'No';
  if (/\b(pitched|presented|went through the offer|explained the program)\b/i.test(text)) data.pitched = 'Yes';
  if (appointmentMatch || /\b(booked|scheduled|set the appointment)\b/i.test(text)) {
    data.disqualified = data.disqualified || 'No';
    data.pitched = data.pitched || 'Yes';
    data.wasSet = 'Yes';
  }
  if (data.wasSet === 'Yes') {
    const closerMatch = text.match(/(?:closer|with)\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){1,2})/i);
    if (closerMatch) data.closer = closerMatch[1].trim();
  }
  return data;
}

if (typeof globalThis !== 'undefined') {
  globalThis.extractConversationData = extractConversationData;
}

if (typeof module !== 'undefined') {
  module.exports = { extractCallDuration, extractConversationData, getTodayAtTime };
}
