import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const eventType = await prisma.eventType.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      durationMinutes: true,
      color: true,
      active: true,
      locationType: true,
      user: { select: { name: true, timezone: true, companyName: true } },
    },
  });

  if (!eventType || !eventType.active) {
    return NextResponse.json({ error: "Tipo de evento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ eventType });
}
