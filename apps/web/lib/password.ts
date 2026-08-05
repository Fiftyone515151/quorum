// Password policy, shared by the register form (client) and the register API
// (server). Pure + no imports so it's unit-testable.

export const PASSWORD_RULE =
  "At least 8 characters, using at least two of: uppercase, lowercase, number, symbol.";

export function validatePassword(pw: string): { ok: true } | { ok: false; error: string } {
  if (typeof pw !== "string" || pw.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };
  let classes = 0;
  if (/[A-Z]/.test(pw)) classes++;
  if (/[a-z]/.test(pw)) classes++;
  if (/[0-9]/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  if (classes < 2)
    return { ok: false, error: "Use at least two of: uppercase, lowercase, number, symbol." };
  return { ok: true };
}
