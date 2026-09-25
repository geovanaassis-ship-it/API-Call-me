import { NextResponse } from "next/server";
import { toZonedTime, fromZonedTime, format as formatTz } from "date-fns-tz";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { createBookingSchema } from "@/lib/validation";
import { computeSlotsForDay } from "@/lib/availability";
import { resolveVideoLink, generateJitsiRoomUrl } from "@/lib/video";
import { sendBookingEmails } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getBusyIntervals, createTeamsEvent } from "@/lib/microsoft-graph";

const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_BOOKINGS = 8; // tentativas de agendamento por IP a cada 15 minutos
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_MAX_BOOKINGS = 5; // tentativas por e-mail de convidado por hora

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const ipCheck = await checkRateLimit(`booking:ip:${ip}`, { windowMs: IP_WINDOW_MS, max: IP_MAX_BOOKINGS });
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas de agendamento a partir deste endereço. Aguarde alguns minutos e tente novamente." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { eventTypeSlug, startTime, attendeeName, attendeeEmail, attendeePhone, attendeeCompany, notes } =
    parsed.data;

  const emailCheck = await checkRateLimit(`booking:email:${attendeeEmail.toLowerCase()}`, {
    windowMs: EMAIL_WINDOW_MS,
    max: EMAIL_MAX_BOOKINGS,
  });
  if (!emailCheck.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas de agendamento com este e-mail. Aguarde um pouco e tente novamente." },
      { status: 429 },
    );
  }

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

  let microsoftBusy: { startTime: Date; endTime: Date }[] = [];
  try {
    const dayStartUtc = fromZonedTime(`${localDateStr}T00:00:00`, eventType.user.timezone);
    const dayEndUtc = fromZonedTime(`${localDateStr}T23:59:59`, eventType.user.timezone);
    const intervals = await getBusyIntervals(eventType.userId, dayStartUtc, dayEndUtc);
    microsoftBusy = intervals.map((i) => ({ startTime: i.start, endTime: i.end }));
  } catch (err) {
    console.error("[bookings] Falha ao consultar agenda do Outlook, ignorando:", err);
  }

  const validSlots = computeSlotsForDay({
    dateStr: localDateStr,
    user: eventType.user,
    eventType,
    weeklyAvailability,
    dateOverride: matchingOverride,
    existingBookings: [...existingBookings, ...microsoftBusy],
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

  let { videoLink, locationLabel } = resolveVideoLink({
    locationType: eventType.locationType,
    locationValue: eventType.locationValue,
    bookingUid: booking.uid,
  });
  let microsoftEventId: string | null = null;

  if (eventType.locationType === "TEAMS_AUTO") {
    try {
      const result = await createTeamsEvent({
        userId: eventType.userId,
        subject: `${eventType.title} — ${attendeeName}`,
        bodyHtml: `<p>Call agendada via Agenda R.I.</p>${notes ? `<p>Observações: ${notes}</p>` : ""}`,
        startUtc: requestedStart,
        endUtc: requestedEnd,
        attendeeEmail,
        attendeeName,
      });
      if (result) {
        videoLink = result.joinUrl;
        microsoftEventId = result.eventId;
      } else {
        // Conta Microsoft não conectada: usa um link de reserva pra não deixar sem videochamada.
        videoLink = generateJitsiRoomUrl(booking.uid);
        locationLabel = "Videochamada (Jitsi Meet — Teams automático ainda não conectado)";
      }
    } catch (err) {
      console.error("[bookings] Falha ao criar evento no Outlook/Teams, usando link de reserva:", err);
      videoLink = generateJitsiRoomUrl(booking.uid);
      locationLabel = "Videochamada (Jitsi Meet — falha ao gerar Teams)";
    }
  }

  if (videoLink || microsoftEventId) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { videoLink, microsoftEventId },
    });
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
