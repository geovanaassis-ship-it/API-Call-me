import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const eventTypes = await prisma.eventType.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      durationMinutes: true,
      color: true,
      locationType: true,
    },
  });

  return NextResponse.json({ eventTypes });
}
