const HEX_CHARS = '0123456789abcdef';

export function generateMockHash(): string {
  let hash = '';
  for (let i = 0; i < 64; i += 1) {
    hash += HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)];
  }
  return hash;
}

export function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
