import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCancellationEmails } from "@/lib/email";
import { cancelMicrosoftEvent } from "@/lib/microsoft-graph";

export async function GET(_req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const booking = await prisma.booking.findUnique({
    where: { uid },
    include: { eventType: { include: { user: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    booking: {
      uid: booking.uid,
      status: booking.status,
      startTime: booking.startTime,
      endTime: booking.endTime,
      attendeeName: booking.attendeeName,
      attendeeEmail: booking.attendeeEmail,
      videoLink: booking.videoLink,
      eventType: {
        title: booking.eventType.title,
        description: booking.eventType.description,
      },
      organizer: {
        name: booking.eventType.user.name,
        timezone: booking.eventType.user.timezone,
      },
    },
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  const { uid } = await params;
  const booking = await prisma.booking.findUnique({
    where: { uid },
    include: { eventType: { include: { user: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ ok: true });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED", cancellationReason: reason },
  });

  if (booking.microsoftEventId) {
    cancelMicrosoftEvent(booking.eventType.userId, booking.microsoftEventId, reason ?? undefined).catch((err) =>
      console.error("[bookings] Falha ao cancelar evento no Outlook:", err),
    );
  }

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
