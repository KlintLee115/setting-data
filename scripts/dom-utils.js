function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function createMetaRow(parts) {
  const row = createTextElement('div', 'queue-item-meta-row', '');
  parts.forEach(({ text, className }) => {
    row.appendChild(createTextElement('span', className, text));
  });
  return row;
}

function createLabelValueRow(label, value) {
  return createMetaRow([
    { text: label, className: 'queue-item-meta-label' },
    { text: value, className: 'queue-item-meta-value' }
  ]);
}

if (typeof module !== 'undefined') {
  module.exports = {
    createLabelValueRow,
    createMetaRow,
    createTextElement
  };
}
