const GRAPH_SCOPES = [
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
  "OnlineMeetings.ReadWrite",
].join(" ");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida.`);
  return value;
}

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL / NEXTAUTH_URL não definida.");
  return `${appUrl.replace(/\/$/, "")}/api/integrations/microsoft/callback`;
}

export function isMicrosoftIntegrationConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID,
  );
}

export function buildAuthorizationUrl(state: string): string {
  const tenantId = requireEnv("MICROSOFT_TENANT_ID");
  const clientId = requireEnv("MICROSOFT_CLIENT_ID");

  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", GRAPH_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");

  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const tenantId = requireEnv("MICROSOFT_TENANT_ID");
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao obter token da Microsoft (${res.status}): ${text}`);
  }

  return res.json();
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return requestToken({
    client_id: requireEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requireEnv("MICROSOFT_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    scope: GRAPH_SCOPES,
  });
}

export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return requestToken({
    client_id: requireEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requireEnv("MICROSOFT_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: GRAPH_SCOPES,
  });
}
