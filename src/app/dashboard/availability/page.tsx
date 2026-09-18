"use client";

import { useEffect, useState } from "react";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface DayRule {
  active: boolean;
  startTime: string;
  endTime: string;
}

interface DateOverride {
  id: string;
  date: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

function defaultRules(): DayRule[] {
  return DAY_NAMES.map((_, i) => ({
    active: i >= 1 && i <= 5,
    startTime: "09:00",
    endTime: "18:00",
  }));
}

export default function AvailabilityPage() {
  const [rules, setRules] = useState<DayRule[]>(defaultRules());
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideBlocked, setOverrideBlocked] = useState(true);
  const [overrideStart, setOverrideStart] = useState("09:00");
  const [overrideEnd, setOverrideEnd] = useState("18:00");

  useEffect(() => {
    fetch("/api/dashboard/availability")
      .then((res) => res.json())
      .then((data) => {
        const loaded = defaultRules().map((r) => ({ ...r, active: false }));
        for (const rule of data.rules ?? []) {
          loaded[rule.dayOfWeek] = { active: true, startTime: rule.startTime, endTime: rule.endTime };
        }
        setRules(loaded);
      });

    loadOverrides();
  }, []);

  function loadOverrides() {
    fetch("/api/dashboard/date-overrides")
      .then((res) => res.json())
      .then((data) => setOverrides(data.overrides ?? []));
  }

  async function handleSaveRules() {
    setSaving(true);
    setSavedMessage(null);
    try {
      const payload = rules
        .map((rule, dayOfWeek) => ({ ...rule, dayOfWeek }))
        .filter((r) => r.active)
        .map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime }));

      const res = await fetch("/api/dashboard/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: payload }),
      });
      if (res.ok) setSavedMessage("Disponibilidade salva.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!overrideDate) return;
    await fetch("/api/dashboard/date-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: overrideDate,
        isAvailable: !overrideBlocked,
        startTime: overrideBlocked ? null : overrideStart,
        endTime: overrideBlocked ? null : overrideEnd,
      }),
    });
    setOverrideDate("");
    loadOverrides();
  }

  async function removeOverride(id: string) {
    await fetch(`/api/dashboard/date-overrides/${id}`, { method: "DELETE" });
    loadOverrides();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-6 text-xl font-semibold">Disponibilidade semanal</h1>
        <div className="card space-y-3 p-5">
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-4">
              <label className="flex w-36 items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.active}
                  onChange={(e) =>
                    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, active: e.target.checked } : r)))
                  }
                />
                <span className="text-sm font-medium">{DAY_NAMES[i]}</span>
              </label>
              {rule.active ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="input"
                    value={rule.startTime}
                    onChange={(e) =>
                      setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, startTime: e.target.value } : r)))
                    }
                  />
                  <span className="text-slate-400">até</span>
                  <input
                    type="time"
                    className="input"
                    value={rule.endTime}
                    onChange={(e) =>
                      setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, endTime: e.target.value } : r)))
                    }
                  />
                </div>
              ) : (
                <span className="text-sm text-slate-400">Indisponível</span>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSaveRules} disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Salvar disponibilidade"}
            </button>
            {savedMessage && <span className="text-sm text-green-600">{savedMessage}</span>}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Exceções de data</h2>
        <p className="mb-4 text-sm text-slate-500">
          Bloqueie um dia específico (férias, feriado) ou defina um horário diferente do padrão semanal.
        </p>

        <form onSubmit={handleAddOverride} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label">Data</label>
            <input
              type="date"
              required
              className="input"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={overrideBlocked} onChange={(e) => setOverrideBlocked(e.target.checked)} />
            Bloquear o dia inteiro
          </label>
          {!overrideBlocked && (
            <>
              <div>
                <label className="label">Início</label>
                <input
                  type="time"
                  className="input"
                  value={overrideStart}
                  onChange={(e) => setOverrideStart(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Fim</label>
                <input type="time" className="input" value={overrideEnd} onChange={(e) => setOverrideEnd(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn-primary">
            Adicionar exceção
          </button>
        </form>

        <div className="space-y-2">
          {overrides.map((o) => (
            <div key={o.id} className="card flex items-center justify-between p-3">
              <span className="text-sm">
                {new Date(o.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })} —{" "}
                {o.isAvailable ? `disponível ${o.startTime}–${o.endTime}` : "bloqueado"}
              </span>
              <button onClick={() => removeOverride(o.id)} className="btn-danger">
                Remover
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
