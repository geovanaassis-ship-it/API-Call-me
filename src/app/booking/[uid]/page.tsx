"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatFullDateInTz } from "@/lib/client-date";

interface BookingDetail {
  uid: string;
  status: "CONFIRMED" | "CANCELLED";
  startTime: string;
  endTime: string;
  attendeeName: string;
  attendeeEmail: string;
  videoLink: string | null;
  eventType: { title: string; description: string | null };
  organizer: { name: string; timezone: string };
}

export default function BookingConfirmationPage() {
  const params = useParams<{ uid: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);

  function load() {
    fetch(`/api/public/bookings/${params.uid}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setBooking(data.booking);
      })
      .catch(() => setNotFound(true));
  }

  useEffect(load, [params.uid]);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/public/bookings/${params.uid}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        load();
        setShowCancelForm(false);
      }
    } finally {
      setCancelling(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Agendamento não encontrado</h1>
      </main>
    );
  }

  if (!booking) {
    return <main className="mx-auto max-w-lg px-6 py-24 text-center text-slate-500">Carregando...</main>;
  }

  const isCancelled = booking.status === "CANCELLED";

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="card p-6 text-center">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
            isCancelled ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
          }`}
        >
          {isCancelled ? "✕" : "✓"}
        </div>
        <h1 className="text-xl font-semibold">
          {isCancelled ? "Agendamento cancelado" : "Agendamento confirmado!"}
        </h1>
        <p className="mt-2 text-slate-600">{booking.eventType.title}</p>
        <p className="mt-1 text-sm text-slate-500">
          {formatFullDateInTz(booking.startTime, booking.organizer.timezone)}
        </p>

        {!isCancelled && booking.videoLink && (
          <a
            href={booking.videoLink}
            target="_blank"
            rel="noreferrer"
            className="btn-primary mt-4 inline-flex"
          >
            Entrar na videochamada
          </a>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4 text-left text-sm text-slate-500">
          <p>
            <strong>Convidado:</strong> {booking.attendeeName} ({booking.attendeeEmail})
          </p>
          <p className="mt-1">
            <strong>Com:</strong> {booking.organizer.name}
          </p>
        </div>

        {!isCancelled && !showCancelForm && (
          <button onClick={() => setShowCancelForm(true)} className="btn-secondary mt-6 w-full">
            Cancelar agendamento
          </button>
        )}

        {!isCancelled && showCancelForm && (
          <div className="mt-6 space-y-3 text-left">
            <label className="label" htmlFor="reason">
              Motivo do cancelamento (opcional)
            </label>
            <textarea
              id="reason"
              className="input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={cancelling} className="btn-danger flex-1">
                {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
              <button onClick={() => setShowCancelForm(false)} className="btn-secondary flex-1">
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
