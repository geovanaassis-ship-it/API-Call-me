import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "upcoming";
  const now = new Date();

  const bookings = await prisma.booking.findMany({
    where: {
      eventType: { userId },
      ...(scope === "upcoming" ? { startTime: { gte: now }, status: "CONFIRMED" } : {}),
      ...(scope === "past" ? { startTime: { lt: now } } : {}),
      ...(scope === "cancelled" ? { status: "CANCELLED" } : {}),
    },
    include: { eventType: { select: { title: true, color: true, durationMinutes: true } } },
    orderBy: { startTime: scope === "past" ? "desc" : "asc" },
    take: 200,
  });

  return NextResponse.json({ bookings });
}
