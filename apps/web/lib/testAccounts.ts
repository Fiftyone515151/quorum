// Accounts that bypass one-time guards (e.g. the onboarding funnel) so they can
// re-run flows freely while testing. Extend via TEST_BYPASS_EMAILS (comma-sep).
const BUILTIN_TESTERS = ["fiftyones515151@gmail.com"];

export function isUnlimitedTester(email?: string | null): boolean {
  if (!email) return false;
  const extra = (process.env.TEST_BYPASS_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...BUILTIN_TESTERS, ...extra].includes(email.toLowerCase());
}
