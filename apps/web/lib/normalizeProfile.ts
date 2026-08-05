// Server-only: tidy the founder's messy chat answers into clean, faithful
// profile fields before they're stored. Runs invisibly at company creation.
// Never blocks creation — on any failure we fall back to the raw answers.
// Server-only: only imported by route handlers (uses DEEPSEEK_API_KEY).
import { generateStructured } from "@quorum/engine";
import { PROFILE_FIELDS, cleanProfile, profileSchema, type ProfileAnswers } from "./profile";

const SYSTEM = [
  "You clean up a startup founder's rough, chat-typed answers into tidy, readable profile fields for an investor panel to read.",
  "Rules:",
  "- Only reorganize, de-duplicate, fix grammar/typos, and tighten wording.",
  "- Never invent facts, numbers, names, or claims the founder did not state. Faithfulness beats polish.",
  "- Keep each field concise (a few sentences at most). Do not add headings.",
  "- If a field's answer is empty or the founder skipped it, return an empty string for that field.",
  "- Write in clear English.",
].join("\n");

/** Build the user prompt from whichever answers the founder actually gave. */
function buildUser(raw: ProfileAnswers): string {
  const lines: string[] = [
    "Here are the founder's raw answers, keyed by field. Clean each one and return a JSON object with the same keys.",
    "",
  ];
  for (const { key, label } of PROFILE_FIELDS) {
    const v = raw[key];
    if (v && v.trim()) lines.push(`### ${key} (${label})\n${v.trim()}\n`);
  }
  return lines.join("\n");
}

/**
 * Tidy the raw profile answers with DeepSeek. Returns cleaned answers on
 * success; on ANY error (timeout, bad JSON, missing key) returns the trimmed
 * raw answers so company creation is never blocked by the tidy step.
 */
export async function normalizeProfile(rawInput: unknown): Promise<ProfileAnswers> {
  const raw = cleanProfile(rawInput);
  if (Object.keys(raw).length === 0) return raw; // nothing to tidy

  try {
    const tidied = await generateStructured<ProfileAnswers>({
      provider: "deepseek",
      system: SYSTEM,
      user: buildUser(raw),
      schema: profileSchema,
      temperature: 0.2,
      maxTokens: 1200,
    });
    const cleaned = cleanProfile(tidied);
    // Guard against the model dropping everything: if it returns nothing
    // usable, keep the founder's original words.
    return Object.keys(cleaned).length ? cleaned : raw;
  } catch {
    return raw;
  }
}
