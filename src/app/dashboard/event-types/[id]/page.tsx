"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const LOCATION_LABELS: Record<string, string> = {
  JITSI: "Videochamada (Jitsi, automático)",
  GOOGLE_MEET: "Google Meet (link manual)",
  ZOOM: "Zoom (link manual)",
  TEAMS: "Microsoft Teams (link manual)",
  PHONE: "Ligação telefônica",
  IN_PERSON: "Presencial",
  CUSTOM: "Personalizado",
};

interface EventTypeFull {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  color: string;
  active: boolean;
  locationType: string;
  locationValue: string | null;
}

export default function EditEventTypePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [eventType, setEventType] = useState<EventTypeFull | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/event-types")
      .then((res) => res.json())
      .then((data) => {
        const found = (data.eventTypes ?? []).find((e: EventTypeFull) => e.id === params.id);
        setEventType(found ?? null);
      });
  }, [params.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!eventType) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/event-types/${eventType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventType.title,
          slug: eventType.slug,
          description: eventType.description,
          durationMinutes: eventType.durationMinutes,
          color: eventType.color,
          locationType: eventType.locationType,
          locationValue: eventType.locationValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      router.push("/dashboard/event-types");
    } finally {
      setSaving(false);
    }
  }

  if (!eventType) {
    return <p className="text-slate-400">Carregando...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Editar tipo de reunião</h1>
      <form onSubmit={handleSave} className="card max-w-xl space-y-4 p-5">
        <div>
          <label className="label">Título</label>
          <input
            required
            className="input"
            value={eventType.title}
            onChange={(e) => setEventType((v) => v && { ...v, title: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Slug (link público)</label>
          <input
            required
            className="input"
            value={eventType.slug}
            onChange={(e) => setEventType((v) => v && { ...v, slug: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Descrição</label>
          <textarea
            className="input"
            rows={2}
            value={eventType.description ?? ""}
            onChange={(e) => setEventType((v) => v && { ...v, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Duração (minutos)</label>
            <input
              type="number"
              min={5}
              max={480}
              className="input"
              value={eventType.durationMinutes}
              onChange={(e) => setEventType((v) => v && { ...v, durationMinutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Cor</label>
            <input
              type="color"
              className="input h-10"
              value={eventType.color}
              onChange={(e) => setEventType((v) => v && { ...v, color: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Local / Videochamada</label>
          <select
            className="input"
            value={eventType.locationType}
            onChange={(e) => setEventType((v) => v && { ...v, locationType: e.target.value })}
          >
            {Object.entries(LOCATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {eventType.locationType !== "JITSI" && (
          <div>
            <label className="label">
              {eventType.locationType === "IN_PERSON"
                ? "Endereço"
                : eventType.locationType === "PHONE"
                  ? "Número de telefone"
                  : "Link da videochamada"}
            </label>
            <input
              className="input"
              value={eventType.locationValue ?? ""}
              onChange={(e) => setEventType((v) => v && { ...v, locationValue: e.target.value })}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
          <button type="button" onClick={() => router.push("/dashboard/event-types")} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
