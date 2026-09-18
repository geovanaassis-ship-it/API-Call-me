import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const override = await prisma.dateOverride.findUnique({ where: { id } });
  if (!override || override.userId !== userId) {
    return NextResponse.json({ error: "Exceção não encontrada" }, { status: 404 });
  }

  await prisma.dateOverride.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
