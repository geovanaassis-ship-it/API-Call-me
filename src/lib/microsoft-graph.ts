import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { refreshTokens } from "@/lib/microsoft-oauth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Retorna um access token válido para o usuário, renovando com o refresh
 * token se estiver perto de expirar. Retorna null se não houver conta
 * Microsoft conectada.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.microsoftAccount.findUnique({ where: { userId } });
  if (!account) return null;

  const expiresSoon = account.expiresAt.getTime() - Date.now() < 2 * 60 * 1000;
  if (!expiresSoon) {
    return decrypt(account.accessTokenEnc);
  }

  const refreshToken = decrypt(account.refreshTokenEnc);
  const tokens = await refreshTokens(refreshToken);

  await prisma.microsoftAccount.update({
    where: { userId },
    data: {
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: encrypt(tokens.refresh_token ?? refreshToken),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    },
  });

  return tokens.access_token;
}

async function graphFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="UTC"',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph API respondeu ${res.status}: ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

/** Busca eventos reais do Outlook no intervalo e retorna os que representam tempo ocupado. */
export async function getBusyIntervals(
  userId: string,
  rangeStartUtc: Date,
  rangeEndUtc: Date,
): Promise<BusyInterval[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  const params = new URLSearchParams({
    startDateTime: rangeStartUtc.toISOString(),
    endDateTime: rangeEndUtc.toISOString(),
    $select: "start,end,showAs",
    $top: "100",
  });

  const data = await graphFetch(accessToken, `/me/calendarView?${params.toString()}`);

  const events: Array<{ start: { dateTime: string }; end: { dateTime: string }; showAs: string }> =
    data?.value ?? [];

  return events
    .filter((e) => e.showAs && e.showAs !== "free")
    .map((e) => ({
      start: new Date(`${e.start.dateTime}Z`),
      end: new Date(`${e.end.dateTime}Z`),
    }));
}

export interface CreateTeamsEventParams {
  userId: string;
  subject: string;
  bodyHtml: string;
  startUtc: Date;
  endUtc: Date;
  attendeeEmail: string;
  attendeeName: string;
}

export interface CreateTeamsEventResult {
  eventId: string;
  joinUrl: string | null;
}

/** Cria o evento no Outlook do R.I. com uma reunião do Teams única para essa call. */
export async function createTeamsEvent(params: CreateTeamsEventParams): Promise<CreateTeamsEventResult | null> {
  const accessToken = await getValidAccessToken(params.userId);
  if (!accessToken) return null;

  const data = await graphFetch(accessToken, "/me/events", {
    method: "POST",
    body: JSON.stringify({
      subject: params.subject,
      body: { contentType: "HTML", content: params.bodyHtml },
      start: { dateTime: params.startUtc.toISOString(), timeZone: "UTC" },
      end: { dateTime: params.endUtc.toISOString(), timeZone: "UTC" },
      attendees: [
        {
          emailAddress: { address: params.attendeeEmail, name: params.attendeeName },
          type: "required",
        },
      ],
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    }),
  });

  return {
    eventId: data.id,
    joinUrl: data.onlineMeeting?.joinUrl ?? null,
  };
}

/** Cancela (com aviso aos participantes) o evento correspondente no Outlook do R.I. */
export async function cancelMicrosoftEvent(userId: string, eventId: string, comment?: string): Promise<void> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  try {
    await graphFetch(accessToken, `/me/events/${eventId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ comment: comment ?? "Agendamento cancelado." }),
    });
  } catch (err) {
    console.error("[microsoft-graph] Falha ao cancelar evento no Outlook:", err);
  }
}
