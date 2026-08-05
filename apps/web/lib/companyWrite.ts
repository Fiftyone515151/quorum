// Shared assembly for creating/updating a Company. Both the plain edit form
// and the onboarding chat funnel through here so the stored shape can't drift:
//   bp (panel corpus) = assembleProfile(topic, profile, docText)
import { z } from "zod";
import { Stage } from "@quorum/db";
import { assembleProfile, cleanProfile, hasSubstance, profileSchema } from "./profile";
import { normalizeProfile } from "./normalizeProfile";

export const companyInputSchema = z.object({
  name: z.string().min(1).optional(),
  topic: z.string().optional(),
  docText: z.string().optional(), // raw extracted text of uploaded doc(s)
  bpFileName: z.string().optional(),
  fundingCurrency: z.string().optional(),
  valuation: z.string().optional(),
  roundSize: z.string().optional(),
  stage: z.enum(["pre_seed", "seed", "A"]).optional(),
  profile: profileSchema.optional(),
  // When true, the messy chat answers get tidied by DeepSeek before storage.
  fromOnboarding: z.boolean().optional(),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;

export interface CompanyWriteData {
  name?: string;
  topic?: string | null;
  docText?: string | null;
  bp?: string;
  bpFileName?: string | null;
  fundingCurrency?: string | null;
  valuation?: string | null;
  roundSize?: string | null;
  stage?: Stage;
  profile?: any;
}

/**
 * Turn a validated input into the columns to write. `existing` supplies the
 * current topic/profile/docText on PATCH so a partial edit still re-derives a
 * complete bp. Returns null when there's not enough substance to form a corpus.
 */
export async function buildCompanyData(
  input: CompanyInput,
  existing?: { topic?: string | null; profile?: unknown; docText?: string | null }
): Promise<CompanyWriteData | null> {
  const data: CompanyWriteData = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.fundingCurrency !== undefined) data.fundingCurrency = input.fundingCurrency;
  if (input.valuation !== undefined) data.valuation = input.valuation;
  if (input.roundSize !== undefined) data.roundSize = input.roundSize;
  if (input.stage !== undefined) data.stage = input.stage as Stage;
  if (input.bpFileName !== undefined) data.bpFileName = input.bpFileName;

  // Resolve the three corpus sources, falling back to what's already stored.
  const topic = input.topic !== undefined ? input.topic : (existing?.topic ?? undefined);
  const docText = input.docText !== undefined ? input.docText : (existing?.docText ?? undefined);
  let profile = input.profile !== undefined ? input.profile : existing?.profile;

  const profileTouched = input.profile !== undefined;
  const corpusTouched = profileTouched || input.topic !== undefined || input.docText !== undefined;

  if (profileTouched) {
    profile = input.fromOnboarding ? await normalizeProfile(input.profile) : cleanProfile(input.profile);
    data.profile = profile;
  }
  if (input.topic !== undefined) data.topic = input.topic;
  if (input.docText !== undefined) data.docText = input.docText;

  // Only recompute bp when a corpus source changed (or on create).
  if (corpusTouched || existing === undefined) {
    if (!hasSubstance({ topic, profile, fileText: docText })) return null;
    data.bp = assembleProfile({ topic, profile, fileText: docText });
  }
  return data;
}
