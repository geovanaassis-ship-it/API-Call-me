import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventTypeSlug = url.searchParams.get("eventTypeSlug");
  const date = url.searchParams.get("date"); // "YYYY-MM-DD"

  if (!eventTypeSlug || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const slots = await getAvailableSlots(eventTypeSlug, date);

  return NextResponse.json({
    slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
  });
}
