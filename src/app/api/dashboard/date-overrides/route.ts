import { NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { dateOverrideSchema } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const overrides = await prisma.dateOverride.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ overrides });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = dateOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const date = fromZonedTime(`${parsed.data.date}T00:00:00`, user.timezone);

  const override = await prisma.dateOverride.upsert({
    where: { userId_date: { userId, date } },
    update: {
      isAvailable: parsed.data.isAvailable,
      startTime: parsed.data.startTime ?? null,
      endTime: parsed.data.endTime ?? null,
    },
    create: {
      userId,
      date,
      isAvailable: parsed.data.isAvailable,
      startTime: parsed.data.startTime ?? null,
      endTime: parsed.data.endTime ?? null,
    },
  });

  return NextResponse.json({ override }, { status: 201 });
}
