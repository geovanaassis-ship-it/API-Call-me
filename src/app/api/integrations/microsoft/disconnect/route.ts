import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await prisma.microsoftAccount.deleteMany({ where: { userId } });

  return NextResponse.json({ ok: true });
}
