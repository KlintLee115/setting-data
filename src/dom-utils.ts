export interface TextPart {
  text: string;
  className?: string;
}

export function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

export function createMetaRow(parts: TextPart[]): HTMLDivElement {
  const row = createTextElement('div', 'queue-item-meta-row', '');
  parts.forEach(({ text, className }) => {
    row.appendChild(createTextElement('span', className || '', text));
  });
  return row;
}

export function createLabelValueRow(label: string, value: string): HTMLDivElement {
  return createMetaRow([
    { text: label, className: 'queue-item-meta-label' },
    { text: value, className: 'queue-item-meta-value' }
  ]);
}
