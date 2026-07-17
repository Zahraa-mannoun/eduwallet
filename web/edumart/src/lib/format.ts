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

export function categoryLabel(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}
