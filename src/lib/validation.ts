import { z } from "zod";

export const createBookingSchema = z.object({
  eventTypeSlug: z.string().min(1),
  startTime: z.string().datetime(),
  attendeeName: z.string().min(2).max(120),
  attendeeEmail: z.string().email(),
  attendeePhone: z.string().max(30).optional().nullable(),
  attendeeCompany: z.string().max(120).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const eventTypeSchema = z.object({
  title: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  description: z.string().max(1000).optional().nullable(),
  durationMinutes: z.number().int().min(5).max(480),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  active: z.boolean().optional(),
  locationType: z.enum(["JITSI", "GOOGLE_MEET", "ZOOM", "TEAMS", "TEAMS_AUTO", "PHONE", "IN_PERSON", "CUSTOM"]),
  locationValue: z.string().max(500).optional().nullable(),
});

export const weeklyAvailabilitySchema = z.object({
  rules: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(50),
});

export const dateOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isAvailable: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export const settingsSchema = z.object({
  name: z.string().min(2).max(120),
  companyName: z.string().min(2).max(160),
  timezone: z.string().min(2).max(60),
  bufferBeforeMinutes: z.number().int().min(0).max(120),
  bufferAfterMinutes: z.number().int().min(0).max(120),
  minimumNoticeMinutes: z.number().int().min(0).max(10080),
  bookingWindowDays: z.number().int().min(1).max(365),
});
