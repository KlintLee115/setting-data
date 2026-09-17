function getAppointmentLabel(appointmentInstant, now) {
  const diffDays = Math.ceil((appointmentInstant.getTime() - now.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays <= 14) return 'In 2 weeks';
  return `In ${Math.ceil(diffDays / 7)} weeks`;
}

function getUpcomingAppointments(entries, now = new Date(), parseFollowUp = parseFollowUpDate) {
  return entries
    .filter((entry) => entry.appointmentDate)
    .map((entry) => {
      const appointmentInstant = new Date(entry.appointmentDate);
      const followUpDate = entry.followUpDate ? parseFollowUp(entry.followUpDate) : null;
      return {
        ...entry,
        appointmentInstant,
        followUpDate,
        label: getAppointmentLabel(appointmentInstant, now)
      };
    })
    .filter((entry) => Number.isFinite(entry.appointmentInstant.getTime())
      && entry.appointmentInstant.getTime() >= now.getTime())
    .sort((first, second) => first.appointmentInstant - second.appointmentInstant);
}

if (typeof module !== 'undefined') {
  module.exports = {
    getAppointmentLabel,
    getUpcomingAppointments
  };
}
