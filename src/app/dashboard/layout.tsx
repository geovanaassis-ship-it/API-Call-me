"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/dashboard/bookings", label: "Agendamentos" },
  { href: "/dashboard/event-types", label: "Tipos de reunião" },
  { href: "/dashboard/availability", label: "Disponibilidade" },
  { href: "/dashboard/settings", label: "Configurações" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-semibold text-slate-900">Agenda R.I. — More Invest</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary">
            Sair
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <nav className="w-48 flex-shrink-0 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname?.startsWith(item.href)
                  ? "bg-brand-500 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/"
            target="_blank"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-100"
          >
            Ver página pública ↗
          </Link>
        </nav>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
