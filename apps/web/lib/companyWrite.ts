// Shared assembly for creating/updating a Company. The panel corpus (bp) is
// always rebuilt from the company's documents + topic + profile by
// rebuildCorpus(); this module only prepares the scalar fields + normalized
// profile. Both the onboarding chat and the edit form funnel through here.
import { z } from "zod";
import { Stage } from "@quorum/db";
import { cleanProfile, profileSchema } from "./profile";
import { normalizeProfile } from "./normalizeProfile";

export const documentInputSchema = z.object({ fileName: z.string().min(1), text: z.string().min(1) });

export const companyInputSchema = z.object({
  name: z.string().min(1).optional(),
  topic: z.string().optional(),
  fundingCurrency: z.string().optional(),
  valuation: z.string().optional(),
  roundSize: z.string().optional(),
  stage: z.enum(["pre_seed", "angel", "seed", "A"]).optional(),
  profile: profileSchema.optional(),
  // Pre-extracted files from the onboarding chat → become Document rows.
  documents: z.array(documentInputSchema).optional(),
  // When true, the messy chat answers get tidied by DeepSeek before storage.
  fromOnboarding: z.boolean().optional(),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;

/** Prepare the scalar columns + normalized profile to write. bp is NOT set here
 *  — the caller must run rebuildCorpus() afterwards to derive it from documents. */
export async function buildCompanyData(input: CompanyInput): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.fundingCurrency !== undefined) data.fundingCurrency = input.fundingCurrency;
  if (input.valuation !== undefined) data.valuation = input.valuation;
  if (input.roundSize !== undefined) data.roundSize = input.roundSize;
  if (input.stage !== undefined) data.stage = input.stage as Stage;
  if (input.topic !== undefined) data.topic = input.topic;
  if (input.profile !== undefined) {
    data.profile = input.fromOnboarding ? await normalizeProfile(input.profile) : cleanProfile(input.profile);
  }
  return data;
}

/** True if there's enough to describe a startup (name aside): a doc, one-liner, or any profile answer. */
export function hasCompanySubstance(input: CompanyInput): boolean {
  return Boolean(
    input.documents?.length ||
      input.topic?.trim() ||
      (input.profile && Object.keys(cleanProfile(input.profile)).length)
  );
}

export function extOf(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}
