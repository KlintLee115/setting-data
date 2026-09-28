import { getLocalDateTimeValue } from './timezone';

export function getLocalDateValue(date = new Date()): string {
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function updateCallDateTime(documentRef: Document = document): void {
  const callDateTime = documentRef.querySelector<HTMLInputElement>('[name="callDateTime"]');
  if (callDateTime && !callDateTime.value) {
    callDateTime.value = getLocalDateTimeValue();
  }
}

