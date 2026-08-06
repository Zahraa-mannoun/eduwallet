export function formatCardNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return (digits.match(/.{1,4}/g) ?? []).join('-');
}

export function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function formatCvvInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 3);
}

// Extracts the card's own locked category out of the backend's mismatch error message
// (cards.service.ts useCard(): `This card is locked to ${category} — it can't be used for
// ${other}`) so the UI can show the friendlier "[LOCKED] card cannot be used for [DETECTED]
// purchases" phrasing instead of the raw backend string.
export function parseLockedCategoryFromError(message: string): string | null {
  const match = /locked to (\w+)/i.exec(message);
  return match ? match[1].toUpperCase() : null;
}
