(() => {
function getLocalDateValue(date = new Date()) {
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function updateCallDateTime() {
  const callDateTime = document.querySelector('[name="callDateTime"]');
  if (!callDateTime.value) {
    callDateTime.value = getLocalDateTimeValue();
  }
}

const popupSettings = {
  getLocalDateTimeValue,
  getLocalDateValue,
  updateCallDateTime
};

globalThis.popupSettings = popupSettings;

if (typeof module !== 'undefined') {
  module.exports = popupSettings;
}
})();
