import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { eventTypeSchema } from "@/lib/validation";

async function loadOwned(id: string, userId: string) {
  const eventType = await prisma.eventType.findUnique({ where: { id } });
  if (!eventType || eventType.userId !== userId) return null;
  return eventType;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const owned = await loadOwned(id, userId);
  if (!owned) return NextResponse.json({ error: "Tipo de evento não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = eventTypeSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.slug && parsed.data.slug !== owned.slug) {
    const clash = await prisma.eventType.findUnique({ where: { slug: parsed.data.slug } });
    if (clash) {
      return NextResponse.json({ error: "Já existe um tipo de evento com este slug" }, { status: 409 });
    }
  }

  const eventType = await prisma.eventType.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ eventType });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const owned = await loadOwned(id, userId);
  if (!owned) return NextResponse.json({ error: "Tipo de evento não encontrado" }, { status: 404 });

  await prisma.eventType.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
