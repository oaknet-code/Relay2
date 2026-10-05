// Password policy — keep in sync with Relay3/src/middleware/validators.js
// (the server enforces it; this only gives instant feedback).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt ignores anything past 72 bytes

export const PASSWORD_RULES = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: "letter", label: "At least one letter", test: (p) => /[A-Za-z]/.test(p) },
  { id: "number", label: "At least one number", test: (p) => /[0-9]/.test(p) },
];

export const isPasswordValid = (p) =>
  p.length <= PASSWORD_MAX_LENGTH && PASSWORD_RULES.every((r) => r.test(p));

// First unmet rule as a sentence, or "" when valid.
export const passwordProblem = (p) => {
  if (p.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  const failed = PASSWORD_RULES.find((r) => !r.test(p));
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : "";
};

// Strong random password from the browser's CSPRNG: 16 characters, always
// containing letters and numbers. Skips look-alikes (0/O, 1/l/I).
export function generatePassword(length = 16) {
  const letters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const pick = (chars) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return chars[buf[0] % chars.length];
  };
  for (;;) {
    let out = "";
    for (let i = 0; i < length; i++) out += pick(all);
    if (isPasswordValid(out)) return out;
  }
}
