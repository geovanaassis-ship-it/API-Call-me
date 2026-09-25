"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EventType {
  id: string;
  title: string;
  slug: string;
  durationMinutes: number;
  color: string;
  active: boolean;
}

const LOCATION_LABELS: Record<string, string> = {
  JITSI: "Videochamada (Jitsi, automático)",
  GOOGLE_MEET: "Google Meet (link manual)",
  ZOOM: "Zoom (link manual)",
  TEAMS: "Microsoft Teams (link fixo manual)",
  TEAMS_AUTO: "Microsoft Teams (automático, requer conta conectada)",
  PHONE: "Ligação telefônica",
  IN_PERSON: "Presencial",
  CUSTOM: "Personalizado",
};

const LOCATIONS_WITHOUT_MANUAL_LINK = new Set(["JITSI", "TEAMS_AUTO"]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    durationMinutes: 30,
    color: "#3a5ce6",
    locationType: "JITSI",
    locationValue: "",
  });

  function load() {
    fetch("/api/dashboard/event-types")
      .then((res) => res.json())
      .then((data) => setEventTypes(data.eventTypes ?? []));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: form.slug || slugify(form.title),
          locationValue: form.locationValue || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar");
        return;
      }
      setShowForm(false);
      setForm({ title: "", slug: "", description: "", durationMinutes: 30, color: "#3a5ce6", locationType: "JITSI", locationValue: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(eventType: EventType) {
    await fetch(`/api/dashboard/event-types/${eventType.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !eventType.active }),
    });
    load();
  }

  async function remove(eventType: EventType) {
    if (!confirm(`Excluir o tipo de reunião "${eventType.title}"? Agendamentos já feitos serão mantidos.`)) return;
    await fetch(`/api/dashboard/event-types/${eventType.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tipos de reunião</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Fechar" : "Novo tipo de reunião"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4 p-5">
          <div>
            <label className="label">Título</label>
            <input
              required
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Slug (link público)</label>
            <input
              className="input"
              placeholder={form.title ? slugify(form.title) : "gerado automaticamente"}
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Cor</label>
              <input
                type="color"
                className="input h-10"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Local / Videochamada</label>
            <select
              className="input"
              value={form.locationType}
              onChange={(e) => setForm((f) => ({ ...f, locationType: e.target.value }))}
            >
              {Object.entries(LOCATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {LOCATIONS_WITHOUT_MANUAL_LINK.has(form.locationType) ? (
            form.locationType === "TEAMS_AUTO" && (
              <p className="text-xs text-slate-400">
                Um link de reunião do Teams diferente é gerado automaticamente para cada agendamento, via a conta
                Microsoft conectada em Configurações.
              </p>
            )
          ) : (
            <div>
              <label className="label">
                {form.locationType === "IN_PERSON" ? "Endereço" : form.locationType === "PHONE" ? "Número de telefone" : "Link da videochamada"}
              </label>
              <input
                className="input"
                value={form.locationValue}
                onChange={(e) => setForm((f) => ({ ...f, locationValue: e.target.value }))}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando..." : "Criar tipo de reunião"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {eventTypes === null && <p className="text-slate-400">Carregando...</p>}
        {eventTypes?.length === 0 && <p className="text-slate-400">Nenhum tipo de reunião criado ainda.</p>}
        {eventTypes?.map((eventType) => (
          <div key={eventType.id} className="card flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: eventType.color }} />
              <div>
                <p className="font-medium">{eventType.title}</p>
                <p className="text-xs text-slate-400">
                  /book/{eventType.slug} • {eventType.durationMinutes} min
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/event-types/${eventType.id}`} className="btn-secondary">
                Editar
              </Link>
              <button onClick={() => toggleActive(eventType)} className="btn-secondary">
                {eventType.active ? "Desativar" : "Ativar"}
              </button>
              <button onClick={() => remove(eventType)} className="btn-danger">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
