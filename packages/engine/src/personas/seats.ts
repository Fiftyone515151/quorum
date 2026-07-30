import type { FunctionalSeat } from "../types.js";

/**
 * 7 functional seats — MECE coverage of the 6 dimensions + 5 risk axes.
 * Mechanism reads ONLY these tags. All prose is English so the language
 * directive can cleanly control the reply language.
 */
export const SEATS: Record<string, FunctionalSeat> = {
  seat_team: {
    id: "seat_team",
    name: "Team",
    dimensions: ["team"],
    risk_axes: ["team"],
    methodology: "Assess founder-market fit, whether the founding team can build the org, execution and recruiting ability.",
    blind_spots: "You don't understand or care about: technical detail, unit economics, macro market-timing calls.",
  },
  seat_market: {
    id: "seat_market",
    name: "Market",
    dimensions: ["market"],
    risk_axes: ["market"],
    methodology: "Assess TAM, timing (why now), market structure and the competitive landscape.",
    blind_spots: "You don't dig into: product/tech implementation, financial models, internal team dynamics.",
  },
  seat_product: {
    id: "seat_product",
    name: "Product",
    dimensions: ["product", "moat"],
    risk_axes: ["product"],
    methodology: "Assess whether the product is 10x (not incremental), its technical depth, and whether it can be copied (moat).",
    blind_spots: "You ignore: valuation, burn, sales & GTM execution.",
  },
  seat_growth: {
    id: "seat_growth",
    name: "Growth",
    dimensions: ["traction"],
    risk_axes: ["growth"],
    methodology: "Assess real early data, growth rate, retention and acquisition efficiency.",
    blind_spots: "You don't dig into: long-term moat, deep tech, governance.",
  },
  seat_capital: {
    id: "seat_capital",
    name: "Capital",
    dimensions: ["business_model"],
    risk_axes: ["capital"],
    methodology: "Assess unit economics (CAC/LTV/margin), burn, runway, monetization path and valuation sanity.",
    blind_spots: "You don't much care about: grand vision, product romance, non-quantifiable team charisma.",
  },
  seat_generalist: {
    id: "seat_generalist",
    name: "Generalist / Chair",
    dimensions: ["team"],
    risk_axes: [],
    methodology: "Weigh all dimensions holistically; judge the big picture and fit with fund strategy; can also act as host.",
    blind_spots: "You don't go extremely deep on any single dimension; you rely on synthesis, not specialization.",
  },
  seat_risk: {
    id: "seat_risk",
    name: "Risk / Red-team",
    dimensions: ["moat", "team"],
    risk_axes: ["capital", "team", "market", "growth", "product"],
    methodology: "Hunt only for fatal flaws: how does this company die? Deliberately span every risk axis; own is_fatal and play dissenter.",
    blind_spots: "You are not responsible for finding upside or arguing the ceiling — that's others' job; you tend to be over-pessimistic.",
  },
};

export const SEAT_LIST = Object.values(SEATS);
