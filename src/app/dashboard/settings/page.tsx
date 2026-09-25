"use client";

import { useEffect, useState } from "react";

interface MicrosoftStatus {
  configured: boolean;
  connected: boolean;
  microsoftEmail: string | null;
  connectedAt: string | null;
}

const MICROSOFT_CALLBACK_MESSAGES: Record<string, { text: string; tone: "success" | "error" }> = {
  connected: { text: "Conta Microsoft conectada com sucesso!", tone: "success" },
  denied: { text: "A autorização foi cancelada ou negada.", tone: "error" },
  invalid_state: { text: "A sessão de autorização expirou. Tente conectar de novo.", tone: "error" },
  error: { text: "Não foi possível conectar a conta Microsoft. Tente novamente.", tone: "error" },
  not_configured: {
    text: "As credenciais do Microsoft Graph ainda não foram configuradas (peça ao suporte técnico).",
    tone: "error",
  },
};

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

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [msStatus, setMsStatus] = useState<MicrosoftStatus | null>(null);
  const [msDisconnecting, setMsDisconnecting] = useState(false);
  const [microsoftCallback, setMicrosoftCallback] = useState<string | null>(null);

  function loadMicrosoftStatus() {
    fetch("/api/integrations/microsoft/status")
      .then((res) => res.json())
      .then((data) => setMsStatus(data));
  }

  useEffect(() => {
    fetch("/api/dashboard/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data.user));
    loadMicrosoftStatus();

    const param = new URLSearchParams(window.location.search).get("microsoft");
    if (param) {
      setMicrosoftCallback(param);
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, []);

  async function handleDisconnectMicrosoft() {
    if (!confirm("Desconectar a conta Microsoft? Os tipos de reunião com Teams automático vão parar de gerar links até reconectar.")) {
      return;
    }
    setMsDisconnecting(true);
    try {
      await fetch("/api/integrations/microsoft/disconnect", { method: "POST" });
      loadMicrosoftStatus();
    } finally {
      setMsDisconnecting(false);
    }
  }

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("A nova senha e a confirmação não coincidem.");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error ?? "Não foi possível trocar a senha.");
        return;
      }
      setPasswordMessage("Senha alterada com sucesso.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } finally {
      setPasswordSaving(false);
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

      <h2 className="mb-4 mt-8 text-lg font-semibold">Trocar senha</h2>
      <form onSubmit={handleChangePassword} className="card max-w-xl space-y-4 p-5">
        <div>
          <label className="label">Senha atual</label>
          <input
            type="password"
            required
            className="input"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Nova senha</label>
          <input
            type="password"
            required
            minLength={8}
            className="input"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
          />
          <p className="mt-1 text-xs text-slate-400">Mínimo de 8 caracteres.</p>
        </div>
        <div>
          <label className="label">Confirmar nova senha</label>
          <input
            type="password"
            required
            minLength={8}
            className="input"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          />
        </div>

        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={passwordSaving} className="btn-primary">
            {passwordSaving ? "Salvando..." : "Trocar senha"}
          </button>
          {passwordMessage && <span className="text-sm text-green-600">{passwordMessage}</span>}
        </div>
      </form>

      <h2 className="mb-4 mt-8 text-lg font-semibold">Integração Microsoft (Outlook / Teams)</h2>
      <div className="card max-w-xl space-y-4 p-5">
        {microsoftCallback && MICROSOFT_CALLBACK_MESSAGES[microsoftCallback] && (
          <p
            className={`text-sm ${
              MICROSOFT_CALLBACK_MESSAGES[microsoftCallback].tone === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {MICROSOFT_CALLBACK_MESSAGES[microsoftCallback].text}
          </p>
        )}

        {!msStatus && <p className="text-sm text-slate-400">Carregando...</p>}

        {msStatus && !msStatus.configured && (
          <p className="text-sm text-slate-500">
            As credenciais do Microsoft Graph (Client ID, Tenant ID, Client Secret) ainda não foram configuradas
            no servidor. Assim que o TI aprovar o acesso e as credenciais forem adicionadas, essa opção fica
            disponível aqui.
          </p>
        )}

        {msStatus?.configured && !msStatus.connected && (
          <>
            <p className="text-sm text-slate-500">
              Conecte sua conta Microsoft para gerar um link único do Teams por agendamento, checar conflitos
              reais com sua agenda do Outlook, e criar o evento automaticamente na sua agenda.
            </p>
            <a href="/api/integrations/microsoft/connect" className="btn-primary inline-flex">
              Conectar conta Microsoft
            </a>
          </>
        )}

        {msStatus?.configured && msStatus.connected && (
          <>
            <p className="text-sm text-green-600">
              Conectado{msStatus.microsoftEmail ? ` como ${msStatus.microsoftEmail}` : ""}.
            </p>
            <button onClick={handleDisconnectMicrosoft} disabled={msDisconnecting} className="btn-secondary">
              {msDisconnecting ? "Desconectando..." : "Desconectar conta Microsoft"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
