// Public landing-page demo: each visitor gets a throwaway user pre-loaded with
// the "Relay" demo startup, so the guided demo can run a real IC session
// without registration. Demo users are identified by email domain (no schema
// change) and are read-only outside of running sessions.
import { randomBytes } from "crypto";
import { prisma } from "@quorum/db";
import { hashPassword } from "./auth";
import { rebuildCorpus } from "./corpus";

export const DEMO_EMAIL_DOMAIN = "demo.quorum.local";

/** Real LLM sessions cost money — cap what one throwaway demo account can run. */
export const DEMO_MAX_RUNS = 3;
/** …and how many throwaway accounts one IP can mint per day. */
export const DEMO_LOGINS_PER_IP_PER_DAY = 5;

export function isDemoUser(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

export const DEMO_READONLY_ERROR =
  "The demo startup is read-only — sign up (free) to create and edit your own.";

// The demo startup the panel debates. Deliberately debatable: real traction,
// but a thin moat and a crowded market, so the IC has something to fight over.
const DEMO_COMPANY = {
  name: "Relay",
  topic:
    "AI support agent that fully resolves e-commerce tickets end-to-end — refunds, returns, order edits — not just drafts replies.",
  stage: "seed" as const,
  profile: {
    founderTeam:
      "Core team: 3 people. CEO — ex-Shopify PM (4 yrs on checkout), Stanford MBA. CTO — ex-Google ML engineer, previously built support automation at Ada. Founding engineer — ex-Stripe.",
    problem:
      "SMB e-commerce brands (50–5,000 orders/mo) drown in repetitive support tickets — 60–80% are “where is my order”, returns, and refunds. Hiring agents is expensive, and seasonal spikes like BFCM are brutal.",
    product:
      "An AI agent that plugs into Shopify plus Gorgias/Zendesk and takes actions under configurable guardrails — issues refunds, edits orders, creates return labels. The 10x is resolution, not deflection: competitors draft replies, Relay closes tickets.",
    traction:
      "42 paying brands, $31k MRR growing 22% MoM for 5 straight months, 92% logo retention, 68% of tickets resolved fully autonomously.",
    market:
      "$12B customer support software market; 2M+ Shopify merchants. Competitors: Gorgias' native AI, Zendesk AI, Decagon and Sierra (enterprise). We win the SMB wedge on action-taking depth and time-to-value — live in 20 minutes.",
    businessModel:
      "$299–$1,499/mo tiers plus $0.80 per resolved ticket above quota. CAC ≈ $900 (agency channel), LTV ≈ $14k, 71% gross margin including LLM costs.",
    moat:
      "Brand-specific policy engine tuned on each store's historical tickets, plus deep workflow integrations.",
    whyNow:
      "LLMs only recently became reliable enough for constrained action-taking; support labor costs keep rising; the Shopify app store gives distribution.",
    askFocus:
      "Challenge our moat versus Gorgias and Sierra, and whether SMB is the right wedge — or we get squeezed between platform-native AI and enterprise players.",
  },
};

/** Create a fresh throwaway demo user with Relay pre-loaded. Returns the user. */
export async function provisionDemoUser(): Promise<{ id: string; email: string }> {
  const email = `founder-${randomBytes(6).toString("hex")}@${DEMO_EMAIL_DOMAIN}`;
  // Random password, never disclosed — demo sessions only ever come from /api/demo/login.
  const user = await prisma.user.create({
    data: {
      email,
      password: await hashPassword(randomBytes(18).toString("hex")),
      name: "Demo Founder",
      onboardedAt: new Date(),
    },
  });
  const company = await prisma.company.create({
    data: {
      ownerId: user.id,
      name: DEMO_COMPANY.name,
      topic: DEMO_COMPANY.topic,
      stage: DEMO_COMPANY.stage,
      profile: DEMO_COMPANY.profile,
      bp: "", // derived next
    },
  });
  await rebuildCorpus(company.id);
  return { id: user.id, email: user.email };
}
