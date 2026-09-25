import { prisma } from "@/lib/prisma";

/**
 * Limitador de taxa simples baseado em banco de dados (funciona mesmo em
 * ambientes serverless com múltiplas instâncias, ao contrário de um contador
 * em memória). Registra um evento por chave e verifica quantos aconteceram
 * na janela de tempo informada.
 */
export async function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number },
): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - opts.windowMs);

  // Limpa eventos antigos dessa chave para não deixar a tabela crescer sem limite.
  await prisma.rateLimitEvent.deleteMany({ where: { key, createdAt: { lt: since } } });

  // Limpeza esporádica e ampla (chaves de outros IPs/contas), para evitar
  // depender de um cron externo em um app de baixo volume.
  if (Math.random() < 0.02) {
    const longAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: longAgo } } });
  }

  const count = await prisma.rateLimitEvent.count({ where: { key, createdAt: { gte: since } } });

  if (count >= opts.max) {
    return { allowed: false, remaining: 0 };
  }

  await prisma.rateLimitEvent.create({ data: { key } });

  return { allowed: true, remaining: opts.max - count - 1 };
}

export function getClientIp(headers: Headers | Record<string, unknown> | undefined | null): string {
  if (!headers) return "unknown";

  const get = (name: string): string | null => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }
    const value = (headers as Record<string, unknown>)[name];
    if (Array.isArray(value)) return value[0] ?? null;
    return typeof value === "string" ? value : null;
  };

  const forwarded = get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const real = get("x-real-ip");
  if (real) return real;

  return "unknown";
}
