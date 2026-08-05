// Startup profile Q&A: the single source of truth for the onboarding/edit form
// fields AND for assembling the text the VC panel reads.
import { z } from "zod";

export interface ProfileAnswers {
  founderTeam?: string; // required in onboarding (its own field, separate from the optional "team" below)
  problem?: string;
  product?: string;
  traction?: string;
  team?: string;
  market?: string;
  businessModel?: string;
  moat?: string;
  whyNow?: string;
  askFocus?: string;
}

export type ProfileKey = keyof ProfileAnswers;

/** Dimension-aligned questions (B/C in the design). Order drives the optional form + assembly. */
export const PROFILE_QUESTIONS: { key: ProfileKey; label: string; question: string }[] = [
  { key: "problem", label: "Problem & customer", question: "Who has the problem you solve, and what is it?" },
  { key: "product", label: "Product", question: "What have you built, and where's the 10x vs. alternatives?" },
  { key: "traction", label: "Traction", question: "Users / revenue / retention / growth — real numbers if any (say “pre-product” if so)." },
  { key: "team", label: "Team", question: "Who's on the team, and why are you the ones to win?" },
  { key: "market", label: "Market", question: "How big is the market, who else is doing this, and why do you win?" },
  { key: "businessModel", label: "Business model", question: "How do you make money? Unit economics (CAC / LTV) if any." },
  { key: "moat", label: "Moat", question: "What's hard for others to copy?" },
  { key: "whyNow", label: "Why now", question: "Why now, and not three years ago or three years from now?" },
  { key: "askFocus", label: "What to pressure-test", question: "What do you most want this panel to challenge?" },
];

export const FOUNDER_TEAM_LABEL = "Founding team";

/** Every stored profile field with its section label, in assembly order.
 *  = the required founding-team field, then the 9 optional dimension questions. */
export const PROFILE_FIELDS: { key: ProfileKey; label: string }[] = [
  { key: "founderTeam", label: FOUNDER_TEAM_LABEL },
  ...PROFILE_QUESTIONS.map(({ key, label }) => ({ key, label })),
];

/** Zod schema for the profile answers (shared by the create/update routes). */
export const profileSchema = z
  .object(Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, z.string().optional()])) as Record<ProfileKey, z.ZodOptional<z.ZodString>>)
  .partial();

/** Keep only non-empty, known profile answers (trimmed). */
export function cleanProfile(input: unknown): ProfileAnswers {
  const out: ProfileAnswers = {};
  if (!input || typeof input !== "object") return out;
  for (const { key } of PROFILE_FIELDS) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

export interface AssembleInput {
  topic?: string | null; // one-line pitch
  profile?: unknown; // ProfileAnswers-ish
  fileText?: string | null; // extracted text of an uploaded doc
}

/** Build the labeled markdown corpus the panel reads, from Q&A + uploaded doc. */
export function assembleProfile({ topic, profile, fileText }: AssembleInput): string {
  const answers = cleanProfile(profile);
  const parts: string[] = [];
  if (topic && topic.trim()) parts.push(`## One-liner\n${topic.trim()}`);
  for (const { key, label } of PROFILE_FIELDS) {
    if (answers[key]) parts.push(`## ${label}\n${answers[key]}`);
  }
  if (fileText && fileText.trim()) parts.push(`## Uploaded document\n${fileText.trim()}`);
  return parts.join("\n\n");
}

/** True if there's enough to form a profile (so we don't create empty companies). */
export function hasSubstance({ topic, profile, fileText }: AssembleInput): boolean {
  return Boolean((topic && topic.trim()) || (fileText && fileText.trim()) || Object.keys(cleanProfile(profile)).length);
}
