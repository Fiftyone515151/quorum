import { NextResponse } from "next/server";
import { DEFAULT_POOL, STAR_POOL, resolvePersona, DIMENSION_LABELS } from "@quorum/engine";

export const dynamic = "force-dynamic";

function dto(p: (typeof DEFAULT_POOL)[number], isStar: boolean) {
  const r = resolvePersona(p);
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    seat: r.seat.name,
    dimensions: r.dimensions.map((d) => DIMENSION_LABELS[d]),
    stance: r.stance,
    reasoning: r.skin.reasoning,
    identity: r.skin.identity,
    signature: r.skin.signature_move,
    isStar,
  };
}

export async function GET() {
  return NextResponse.json({
    defaults: DEFAULT_POOL.map((p) => dto(p, false)),
    stars: STAR_POOL.map((p) => dto(p, true)),
  });
}
