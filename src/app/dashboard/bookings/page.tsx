"use client";

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  status: "CONFIRMED" | "CANCELLED";
  videoLink: string | null;
  eventType: { title: string; color: string; durationMinutes: number };
}

const SCOPES = [
  { key: "upcoming", label: "Próximos" },
  { key: "past", label: "Passados" },
  { key: "cancelled", label: "Cancelados" },
];

export default function BookingsPage() {
  const [scope, setScope] = useState("upcoming");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function load() {
    setBookings(null);
    fetch(`/api/dashboard/bookings?scope=${scope}`)
      .then((res) => res.json())
      .then((data) => setBookings(data.bookings ?? []));
  }

  useEffect(load, [scope]);

  async function cancelBooking(id: string) {
    const reason = window.prompt("Motivo do cancelamento (opcional):") ?? "";
    setCancellingId(id);
    try {
      await fetch(`/api/dashboard/bookings/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      load();
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Agendamentos</h1>

      <div className="mb-4 flex gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              scope === s.key ? "bg-brand-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {bookings === null && <p className="text-slate-400">Carregando...</p>}
        {bookings?.length === 0 && <p className="text-slate-400">Nenhum agendamento nesta lista.</p>}
        {bookings?.map((booking) => (
          <div key={booking.id} className="card flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: booking.eventType.color }} />
              <div>
                <p className="font-medium">{booking.eventType.title}</p>
                <p className="text-sm text-slate-500">
                  {new Date(booking.startTime).toLocaleString("pt-BR")} • {booking.attendeeName} (
                  {booking.attendeeEmail})
                  {booking.attendeePhone ? ` • ${booking.attendeePhone}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {booking.videoLink && booking.status === "CONFIRMED" && (
                <a href={booking.videoLink} target="_blank" rel="noreferrer" className="btn-secondary">
                  Link da call
                </a>
              )}
              {booking.status === "CONFIRMED" && scope === "upcoming" && (
                <button
                  onClick={() => cancelBooking(booking.id)}
                  disabled={cancellingId === booking.id}
                  className="btn-danger"
                >
                  Cancelar
                </button>
              )}
              {booking.status === "CANCELLED" && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">Cancelado</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
