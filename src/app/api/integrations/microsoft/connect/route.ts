import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireUserId } from "@/lib/session";
import { buildAuthorizationUrl, isMicrosoftIntegrationConfigured } from "@/lib/microsoft-oauth";

const STATE_COOKIE = "ms_oauth_state";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", req.url));

  if (!isMicrosoftIntegrationConfigured()) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?microsoft=not_configured", req.url),
    );
  }

  const state = randomBytes(24).toString("base64url");
  const authorizationUrl = buildAuthorizationUrl(state);

  const res = NextResponse.redirect(authorizationUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return res;
}
