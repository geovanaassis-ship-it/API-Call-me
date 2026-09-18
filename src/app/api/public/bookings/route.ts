import { NextResponse } from "next/server";
import { toZonedTime, format as formatTz } from "date-fns-tz";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { createBookingSchema } from "@/lib/validation";
import { computeSlotsForDay } from "@/lib/availability";
import { resolveVideoLink } from "@/lib/video";
import { sendBookingEmails } from "@/lib/email";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { eventTypeSlug, startTime, attendeeName, attendeeEmail, attendeePhone, attendeeCompany, notes } =
    parsed.data;

  const eventType = await prisma.eventType.findUnique({
    where: { slug: eventTypeSlug },
    include: { user: true },
  });

  if (!eventType || !eventType.active) {
    return NextResponse.json({ error: "Tipo de evento não encontrado" }, { status: 404 });
  }

  const requestedStart = new Date(startTime);
  const requestedEnd = addMinutes(requestedStart, eventType.durationMinutes);

  const localDateStr = formatTz(toZonedTime(requestedStart, eventType.user.timezone), "yyyy-MM-dd", {
    timeZone: eventType.user.timezone,
  });

  const [weeklyAvailability, dateOverride, existingBookings] = await Promise.all([
    prisma.weeklyAvailability.findMany({ where: { userId: eventType.userId } }),
    prisma.dateOverride.findFirst({
      where: { userId: eventType.userId },
      // comparamos por dia calendário; buscamos todas e filtramos abaixo para evitar
      // problemas de conversão de timezone na query.
    }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED", eventType: { userId: eventType.userId } },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const matchingOverride =
    dateOverride &&
    formatTz(toZonedTime(dateOverride.date, eventType.user.timezone), "yyyy-MM-dd", {
      timeZone: eventType.user.timezone,
    }) === localDateStr
      ? dateOverride
      : null;

  const validSlots = computeSlotsForDay({
    dateStr: localDateStr,
    user: eventType.user,
    eventType,
    weeklyAvailability,
    dateOverride: matchingOverride,
    existingBookings,
  });

  const isValidSlot = validSlots.some((slot) => +slot.start === +requestedStart);

  if (!isValidSlot) {
    return NextResponse.json(
      { error: "Este horário não está mais disponível. Escolha outro horário." },
      { status: 409 },
    );
  }

  const booking = await prisma.$transaction(async (tx) => {
    const conflict = await tx.booking.findFirst({
      where: {
        status: "CONFIRMED",
        eventType: { userId: eventType.userId },
        startTime: { lt: requestedEnd },
        endTime: { gt: requestedStart },
      },
    });
    if (conflict) {
      throw new Error("SLOT_TAKEN");
    }

    return tx.booking.create({
      data: {
        eventTypeId: eventType.id,
        startTime: requestedStart,
        endTime: requestedEnd,
        attendeeName,
        attendeeEmail,
        attendeePhone: attendeePhone ?? null,
        attendeeCompany: attendeeCompany ?? null,
        notes: notes ?? null,
      },
    });
  }).catch((err) => {
    if (err instanceof Error && err.message === "SLOT_TAKEN") return null;
    throw err;
  });

  if (!booking) {
    return NextResponse.json(
      { error: "Este horário acabou de ser reservado por outra pessoa. Escolha outro horário." },
      { status: 409 },
    );
  }

  const { videoLink, locationLabel } = resolveVideoLink({
    locationType: eventType.locationType,
    locationValue: eventType.locationValue,
    bookingUid: booking.uid,
  });

  if (videoLink) {
    await prisma.booking.update({ where: { id: booking.id }, data: { videoLink } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  sendBookingEmails({
    uid: booking.uid,
    eventTitle: eventType.title,
    eventDescription: eventType.description,
    start: requestedStart,
    end: requestedEnd,
    locationLabel,
    videoLink,
    attendeeName,
    attendeeEmail,
    organizerName: eventType.user.name,
    organizerEmail: eventType.user.email,
    cancelUrl: `${appUrl}/booking/${booking.uid}`,
  }).catch((err) => console.error("[email] Falha ao enviar confirmação:", err));

  return NextResponse.json({ booking: { uid: booking.uid } }, { status: 201 });
}
