export type MockCard = {
  number: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  holder: string;
};

const randomDigits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

export function generateMockCard(holder: string): MockCard {
  const now = new Date();
  const expiry = new Date(now.getFullYear() + 3, now.getMonth());

  return {
    number: randomDigits(16).replace(/(.{4})(?=.)/g, '$1 '),
    cvv: randomDigits(3),
    expiryMonth: String(expiry.getMonth() + 1).padStart(2, '0'),
    expiryYear: String(expiry.getFullYear()).slice(-2),
    holder,
  };
}
