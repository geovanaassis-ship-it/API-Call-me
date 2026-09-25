import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isMicrosoftIntegrationConfigured } from "@/lib/microsoft-oauth";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const account = await prisma.microsoftAccount.findUnique({
    where: { userId },
    select: { microsoftEmail: true, updatedAt: true },
  });

  return NextResponse.json({
    configured: isMicrosoftIntegrationConfigured(),
    connected: Boolean(account),
    microsoftEmail: account?.microsoftEmail ?? null,
    connectedAt: account?.updatedAt ?? null,
  });
}
