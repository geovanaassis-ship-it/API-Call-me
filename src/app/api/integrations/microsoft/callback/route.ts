import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { exchangeCodeForTokens } from "@/lib/microsoft-oauth";
import { encrypt } from "@/lib/crypto";

const STATE_COOKIE = "ms_oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const settingsUrl = new URL("/dashboard/settings", url);

  const userId = await requireUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", url));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];

  if (errorParam) {
    settingsUrl.searchParams.set("microsoft", "denied");
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    settingsUrl.searchParams.set("microsoft", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    let microsoftEmail: string | null = null;
    try {
      const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        microsoftEmail = me.mail ?? me.userPrincipalName ?? null;
      }
    } catch {
      // não crítico: seguimos sem o e-mail de exibição
    }

    await prisma.microsoftAccount.upsert({
      where: { userId },
      update: {
        microsoftEmail,
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token ?? ""),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
      create: {
        userId,
        microsoftEmail,
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token ?? ""),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
    });

    settingsUrl.searchParams.set("microsoft", "connected");
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("[microsoft-oauth] Falha ao trocar código por tokens:", err);
    settingsUrl.searchParams.set("microsoft", "error");
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }
}
