import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { settingsSchema } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      companyName: true,
      timezone: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
      minimumNoticeMinutes: true,
      bookingWindowDays: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: parsed.data,
    select: {
      name: true,
      email: true,
      companyName: true,
      timezone: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
      minimumNoticeMinutes: true,
      bookingWindowDays: true,
    },
  });

  return NextResponse.json({ user });
}
