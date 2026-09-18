import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const eventTypes = await prisma.eventType.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
  });

  const user = await prisma.user.findFirst({ select: { name: true, companyName: true } });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">
          {user?.companyName ?? "More Invest — Relações com Investidores"}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Agende uma call com {user?.name ?? "o time de R.I."}</h1>
        <p className="mt-2 text-slate-500">Escolha o tipo de reunião e o melhor horário para você.</p>
      </div>

      <div className="space-y-4">
        {eventTypes.length === 0 && (
          <p className="text-center text-slate-500">Nenhum tipo de reunião disponível no momento.</p>
        )}
        {eventTypes.map((eventType) => (
          <Link
            key={eventType.id}
            href={`/book/${eventType.slug}`}
            className="card flex items-center justify-between gap-4 p-5 transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <span
                className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: eventType.color }}
              />
              <div>
                <h2 className="font-semibold text-slate-900">{eventType.title}</h2>
                {eventType.description && (
                  <p className="mt-1 text-sm text-slate-500">{eventType.description}</p>
                )}
              </div>
            </div>
            <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {eventType.durationMinutes} min
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
