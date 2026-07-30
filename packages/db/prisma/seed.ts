import { PrismaClient } from "@prisma/client";
import { ALL_PERSONAS } from "@quorum/engine";

const prisma = new PrismaClient();

async function main() {
  for (const p of ALL_PERSONAS) {
    const data = {
      name: p.name,
      avatar: p.avatar,
      seatId: p.seatId,
      skinId: p.skinId,
      dimensionsOverride: p.dimensionsOverride ?? [],
      riskAxesOverride: p.riskAxesOverride ?? [],
      isPreset: true,
    };
    await prisma.persona.upsert({
      where: { id: p.id },
      update: data,
      create: { id: p.id, ...data },
    });
  }
  console.log(`Seeded ${ALL_PERSONAS.length} preset personas.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
