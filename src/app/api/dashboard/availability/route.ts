import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { weeklyAvailabilitySchema } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rules = await prisma.weeklyAvailability.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ rules });
}

// Substitui todas as regras semanais pelas enviadas (abordagem "set completo",
// mais simples de sincronizar do que diffs individuais).
export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = weeklyAvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  for (const rule of parsed.data.rules) {
    if (rule.startTime >= rule.endTime) {
      return NextResponse.json({ error: "Horário de início deve ser antes do horário de término" }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.weeklyAvailability.deleteMany({ where: { userId } }),
    prisma.weeklyAvailability.createMany({
      data: parsed.data.rules.map((r) => ({ ...r, userId })),
    }),
  ]);

  const rules = await prisma.weeklyAvailability.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ rules });
}
