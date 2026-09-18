import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Agenda R.I. | More Invest",
  description: "Agendamento de calls com o time de Relações com Investidores da More Invest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
