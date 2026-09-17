const outcomeModel = typeof require === 'function' && typeof module !== 'undefined'
  ? require('./outcome-model')
  : globalThis;

function isCallEntry(entry) {
  return entry.entryType === 'Call';
}

function isPickedUp(entry) {
  return isCallEntry(entry) ? entry.status === 'Picked Up' : entry.phonePickedUp === 'Yes';
}

function isNoAnswer(entry) {
  return isCallEntry(entry) ? entry.status === 'No Answer' : entry.phonePickedUp === 'No';
}

function getHourlySummary(entries, getHour) {
  return Array.from({ length: 17 }, (_, index) => index + 5).map((hour) => {
    const hourlyEntries = entries.filter((entry) => getHour(entry) === hour);
    const pickedUp = hourlyEntries.filter(isPickedUp).length;
    return {
      hour,
      total: hourlyEntries.length,
      pickedUp,
      rate: hourlyEntries.length ? (pickedUp / hourlyEntries.length) * 100 : null
    };
  });
}

function getDailySummary(entries, durationToSeconds) {
  const callEntries = entries.filter((entry) => isCallEntry(entry) || ['Yes', 'No'].includes(entry.phonePickedUp));
  const pitchedEntries = entries.filter((entry) => entry.disqualified === 'No');
  const durations = entries.map((entry) => durationToSeconds(entry.callDuration)).filter(Boolean);
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const pitchedCount = pitchedEntries.filter((entry) => entry.pitched === 'Yes').length;
  const setCount = pitchedEntries.filter((entry) => entry.wasSet === 'Yes').length;
  const leaveReasons = outcomeModel.getLeaveReasonCounts(entries);

  return {
    calls: callEntries.length,
    pickups: callEntries.filter(isPickedUp).length,
    noAnswers: callEntries.filter(isNoAnswer).length,
    disqualified: entries.filter((entry) => entry.disqualified === 'Yes').length,
    pitches: entries.filter((entry) => entry.pitched === 'Yes').length,
    appointments: entries.filter((entry) => entry.wasSet === 'Yes').length,
    money: leaveReasons.money,
    partner: leaveReasons.partner,
    timing: leaveReasons.timing,
    hadToGo: leaveReasons.hadToGo,
    pitchRate: pitchedEntries.length ? (pitchedCount / pitchedEntries.length) * 100 : null,
    setRate: pitchedEntries.length ? (setCount / pitchedEntries.length) * 100 : null,
    averageDuration: durations.length ? Math.round(totalDuration / durations.length) : 0
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    getDailySummary,
    getHourlySummary,
    isNoAnswer,
    isPickedUp
  };
}
