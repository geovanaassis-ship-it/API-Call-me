"use client";

import { useEffect, useState } from "react";

interface Settings {
  name: string;
  email: string;
  companyName: string;
  timezone: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  bookingWindowDays: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data.user));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSavedMessage(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.name,
          companyName: settings.companyName,
          timezone: settings.timezone,
          bufferBeforeMinutes: settings.bufferBeforeMinutes,
          bufferAfterMinutes: settings.bufferAfterMinutes,
          minimumNoticeMinutes: settings.minimumNoticeMinutes,
          bookingWindowDays: settings.bookingWindowDays,
        }),
      });
      if (res.ok) setSavedMessage("Configurações salvas.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Configurações</h1>
      <form onSubmit={handleSave} className="card max-w-xl space-y-4 p-5">
        <div>
          <label className="label">Nome exibido</label>
          <input
            className="input"
            value={settings.name}
            onChange={(e) => setSettings((v) => v && { ...v, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">E-mail de login</label>
          <input className="input" value={settings.email} disabled />
        </div>
        <div>
          <label className="label">Nome da empresa/setor</label>
          <input
            className="input"
            value={settings.companyName}
            onChange={(e) => setSettings((v) => v && { ...v, companyName: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Fuso horário</label>
          <input
            className="input"
            value={settings.timezone}
            onChange={(e) => setSettings((v) => v && { ...v, timezone: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">Ex: America/Sao_Paulo</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Buffer antes (min)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={settings.bufferBeforeMinutes}
              onChange={(e) => setSettings((v) => v && { ...v, bufferBeforeMinutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Buffer depois (min)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={settings.bufferAfterMinutes}
              onChange={(e) => setSettings((v) => v && { ...v, bufferAfterMinutes: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Aviso mínimo (min)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={settings.minimumNoticeMinutes}
              onChange={(e) => setSettings((v) => v && { ...v, minimumNoticeMinutes: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-slate-400">Tempo mínimo de antecedência para agendar</p>
          </div>
          <div>
            <label className="label">Janela de agendamento (dias)</label>
            <input
              type="number"
              min={1}
              className="input"
              value={settings.bookingWindowDays}
              onChange={(e) => setSettings((v) => v && { ...v, bookingWindowDays: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-slate-400">Quantos dias no futuro podem ser agendados</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
          {savedMessage && <span className="text-sm text-green-600">{savedMessage}</span>}
        </div>
      </form>
    </div>
  );
}
