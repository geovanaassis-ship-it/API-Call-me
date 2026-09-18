import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { eventTypeSchema } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const eventTypes = await prisma.eventType.findMany({
    where: { userId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ eventTypes });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = eventTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const existingSlug = await prisma.eventType.findUnique({ where: { slug: parsed.data.slug } });
  if (existingSlug) {
    return NextResponse.json({ error: "Já existe um tipo de evento com este slug" }, { status: 409 });
  }

  const maxPosition = await prisma.eventType.aggregate({
    where: { userId },
    _max: { position: true },
  });

  const eventType = await prisma.eventType.create({
    data: {
      ...parsed.data,
      description: parsed.data.description ?? null,
      locationValue: parsed.data.locationValue ?? null,
      userId,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  return NextResponse.json({ eventType }, { status: 201 });
}
