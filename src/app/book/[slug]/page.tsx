"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDateInTz, formatDayLabel, formatTimeInTz } from "@/lib/client-date";

interface EventTypeInfo {
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  color: string;
  locationType: string;
  user: { name: string; timezone: string; companyName: string };
}

interface Slot {
  start: string;
  end: string;
}

const DAYS_TO_SHOW = 30;

export default function BookingPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  const [eventType, setEventType] = useState<EventTypeInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/event-types/${params.slug}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setEventType(data.eventType);
      })
      .catch(() => setNotFound(true));
  }, [params.slug]);

  const timezone = eventType?.user.timezone ?? "America/Sao_Paulo";

  const dateOptions = useMemo(() => {
    const options: { key: string; date: Date }[] = [];
    const seen = new Set<string>();
    const now = new Date();
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const key = formatDateInTz(d, timezone);
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ key, date: d });
      }
    }
    return options;
  }, [timezone]);

  useEffect(() => {
    if (!selectedDate && dateOptions.length > 0) {
      setSelectedDate(dateOptions[0].key);
    }
  }, [dateOptions, selectedDate]);

  useEffect(() => {
    if (!selectedDate || !eventType) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/public/slots?eventTypeSlug=${eventType.slug}&date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, eventType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !eventType) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeSlug: eventType.slug,
          startTime: selectedSlot.start,
          attendeeName: form.name,
          attendeeEmail: form.email,
          attendeePhone: form.phone || null,
          attendeeCompany: form.company || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível confirmar o agendamento.");
        if (res.status === 409 && selectedDate) {
          fetch(`/api/public/slots?eventTypeSlug=${eventType.slug}&date=${selectedDate}`)
            .then((r) => r.json())
            .then((d) => setSlots(d.slots ?? []));
        }
        return;
      }
      router.push(`/booking/${data.booking.uid}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Tipo de reunião não encontrado</h1>
        <p className="mt-2 text-slate-500">Verifique o link ou volte para a página inicial.</p>
      </main>
    );
  }

  if (!eventType) {
    return <main className="mx-auto max-w-3xl px-6 py-24 text-center text-slate-500">Carregando...</main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">{eventType.user.companyName}</p>
        <h1 className="mt-1 text-2xl font-bold">{eventType.title}</h1>
        {eventType.description && <p className="mt-2 text-slate-500">{eventType.description}</p>}
        <p className="mt-2 text-sm text-slate-400">
          Duração: {eventType.durationMinutes} min • Horários no fuso de {timezone}
        </p>
      </div>

      {!selectedSlot ? (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Escolha um dia</h2>
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {dateOptions.map(({ key, date }) => {
              const label = formatDayLabel(date, timezone);
              const isSelected = key === selectedDate;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`flex min-w-[64px] flex-col items-center rounded-lg border px-3 py-2 text-xs transition ${
                    isSelected
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-brand-300"
                  }`}
                >
                  <span className="uppercase">{label.weekday}</span>
                  <span className="text-lg font-semibold">{label.day}</span>
                  <span className="uppercase">{label.month}</span>
                </button>
              );
            })}
          </div>

          <h2 className="mb-3 text-sm font-semibold text-slate-700">Escolha um horário</h2>
          {loadingSlots && <p className="text-sm text-slate-400">Carregando horários...</p>}
          {!loadingSlots && slots && slots.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum horário disponível neste dia.</p>
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {!loadingSlots &&
              slots?.map((slot) => (
                <button
                  key={slot.start}
                  onClick={() => setSelectedSlot(slot)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
                >
                  {formatTimeInTz(slot.start, timezone)}
                </button>
              ))}
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <button onClick={() => setSelectedSlot(null)} className="mb-4 text-sm font-medium text-brand-600">
            ← Escolher outro horário
          </button>
          <p className="mb-4 text-sm text-slate-600">
            Horário selecionado: <strong>{formatTimeInTz(selectedSlot.start, timezone)}</strong> em{" "}
            {formatDayLabel(new Date(selectedSlot.start), timezone).day}/
            {formatDayLabel(new Date(selectedSlot.start), timezone).month}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="name">
                Nome completo
              </label>
              <input
                id="name"
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                className="input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="phone">
                  Telefone (opcional)
                </label>
                <input
                  id="phone"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="company">
                  Empresa (opcional)
                </label>
                <input
                  id="company"
                  className="input"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="notes">
                Observações (opcional)
              </label>
              <textarea
                id="notes"
                className="input"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
              Os dados informados acima (nome, e-mail{form.phone ? ", telefone" : ""}
              {form.company ? ", empresa" : ""}) serão usados exclusivamente por{" "}
              <strong>{eventType.user.companyName}</strong> para agendar, confirmar e realizar esta call, em linha
              com a Lei Geral de Proteção de Dados (LGPD). Não compartilhamos essas informações com terceiros. Ao
              confirmar, você concorda com esse uso.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Confirmando..." : "Confirmar agendamento"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
