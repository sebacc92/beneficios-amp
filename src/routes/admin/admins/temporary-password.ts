/** Shared by the admin list, the forced change screen and the login copy. */
export const MIN_ADMIN_PASSWORD_LENGTH = 10;

// No 0/O, 1/l/I: the password is usually read aloud or copied by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** `Kq7m-P2xz-9WbR`: 12 random characters in groups, from the platform CSPRNG (browser and server). */
export function generateTemporaryPassword(): string {
  const chars: string[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (chars.length < 12) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      // Rejection sampling keeps every character equally likely.
      if (byte < limit && chars.length < 12) chars.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((group) => group.join("")).join("-");
}
