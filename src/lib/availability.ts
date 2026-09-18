import { addMinutes, isBefore } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import type { EventType, User, WeeklyAvailability, DateOverride, Booking } from "@prisma/client";

export interface SlotWindow {
  start: Date; // UTC
  end: Date; // UTC
}

function parseHHMM(value: string): { hours: number; minutes: number } {
  const [hours, minutes] = value.split(":").map(Number);
  return { hours, minutes };
}

/** Converte "YYYY-MM-DD" + "HH:mm" no timezone do usuário para um Date em UTC. */
function localDateTimeToUtc(dateStr: string, time: string, timezone: string): Date {
  const { hours, minutes } = parseHHMM(time);
  const naive = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return fromZonedTime(naive, timezone);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isBefore(bStart, aEnd);
}

/**
 * Calcula os horários de início disponíveis (em UTC) para um dia específico,
 * no timezone do usuário, considerando disponibilidade semanal, exceções de
 * data, agendamentos já confirmados e buffers antes/depois de cada reunião.
 */
export function computeSlotsForDay(params: {
  dateStr: string; // "YYYY-MM-DD" no timezone do usuário
  user: Pick<User, "timezone" | "bufferBeforeMinutes" | "bufferAfterMinutes" | "minimumNoticeMinutes" | "bookingWindowDays">;
  eventType: Pick<EventType, "durationMinutes">;
  weeklyAvailability: WeeklyAvailability[];
  dateOverride: DateOverride | null;
  existingBookings: Pick<Booking, "startTime" | "endTime">[];
  now?: Date;
}): SlotWindow[] {
  const { dateStr, user, eventType, weeklyAvailability, dateOverride, existingBookings } = params;
  const now = params.now ?? new Date();

  const bookingWindowEnd = addMinutes(now, user.bookingWindowDays * 24 * 60);
  const earliestStart = addMinutes(now, user.minimumNoticeMinutes);

  let windows: { startTime: string; endTime: string }[] = [];

  if (dateOverride) {
    if (!dateOverride.isAvailable) {
      return [];
    }
    if (dateOverride.startTime && dateOverride.endTime) {
      windows = [{ startTime: dateOverride.startTime, endTime: dateOverride.endTime }];
    }
  } else {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    windows = weeklyAvailability
      .filter((w) => w.dayOfWeek === dayOfWeek)
      .map((w) => ({ startTime: w.startTime, endTime: w.endTime }));
  }

  const slots: SlotWindow[] = [];
  const duration = eventType.durationMinutes;
  const bufferBefore = user.bufferBeforeMinutes;
  const bufferAfter = user.bufferAfterMinutes;

  for (const window of windows) {
    const windowStartUtc = localDateTimeToUtc(dateStr, window.startTime, user.timezone);
    const windowEndUtc = localDateTimeToUtc(dateStr, window.endTime, user.timezone);

    let cursor = windowStartUtc;
    while (isBefore(addMinutes(cursor, duration), windowEndUtc) || +addMinutes(cursor, duration) === +windowEndUtc) {
      const slotStart = cursor;
      const slotEnd = addMinutes(cursor, duration);

      const withinNotice = !isBefore(slotStart, earliestStart);
      const withinWindow = isBefore(slotStart, bookingWindowEnd);

      const busyStart = addMinutes(slotStart, -bufferBefore);
      const busyEnd = addMinutes(slotEnd, bufferAfter);

      const conflicts = existingBookings.some((b) =>
        overlaps(busyStart, busyEnd, b.startTime, b.endTime),
      );

      if (withinNotice && withinWindow && !conflicts) {
        slots.push({ start: slotStart, end: slotEnd });
      }

      cursor = addMinutes(cursor, duration);
    }
  }

  return slots.sort((a, b) => +a.start - +b.start);
}

export async function getAvailableSlots(eventTypeSlug: string, dateStr: string): Promise<SlotWindow[]> {
  const eventType = await prisma.eventType.findUnique({
    where: { slug: eventTypeSlug },
    include: { user: true },
  });

  if (!eventType || !eventType.active) return [];

  const [weeklyAvailability, dateOverride] = await Promise.all([
    prisma.weeklyAvailability.findMany({ where: { userId: eventType.userId } }),
    prisma.dateOverride.findFirst({
      where: {
        userId: eventType.userId,
        date: fromZonedTime(`${dateStr}T00:00:00`, eventType.user.timezone),
      },
    }),
  ]);

  const dayStartUtc = fromZonedTime(`${dateStr}T00:00:00`, eventType.user.timezone);
  const dayEndUtc = fromZonedTime(`${dateStr}T23:59:59`, eventType.user.timezone);

  const existingBookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      eventType: { userId: eventType.userId },
      startTime: { lte: dayEndUtc },
      endTime: { gte: dayStartUtc },
    },
    select: { startTime: true, endTime: true },
  });

  return computeSlotsForDay({
    dateStr,
    user: eventType.user,
    eventType,
    weeklyAvailability,
    dateOverride,
    existingBookings,
  });
}
