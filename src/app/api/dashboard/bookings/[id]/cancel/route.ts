import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { sendCancellationEmails } from "@/lib/email";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { eventType: { include: { user: true } } },
  });

  if (!booking || booking.eventType.userId !== userId) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED", cancellationReason: reason },
  });

  sendCancellationEmails({
    eventTitle: booking.eventType.title,
    start: booking.startTime,
    attendeeName: booking.attendeeName,
    attendeeEmail: booking.attendeeEmail,
    organizerName: booking.eventType.user.name,
    organizerEmail: booking.eventType.user.email,
    reason,
  }).catch((err) => console.error("[email] Falha ao enviar cancelamento:", err));

  return NextResponse.json({ ok: true });
}
