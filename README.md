# Agenda R.I. — More Invest

Sistema interno de agendamento de calls para o setor de Relações com Investidores, inspirado no [Cal.com](https://cal.com), adaptado às necessidades do time.

Permite que investidores, analistas e jornalistas agendem calls (rápidas, reuniões de investidor, resultados trimestrais etc.) através de um link público, escolhendo um dia e horário livre na agenda do analista de R.I. O sistema:

- Gerencia a disponibilidade semanal e exceções de data (feriados, bloqueios) do analista de R.I.;
- Evita conflitos de horário automaticamente (com buffers configuráveis antes/depois de cada call);
- Gera automaticamente uma sala de videochamada (Jitsi Meet, gratuito, sem necessidade de conta) para cada tipo de reunião — ou permite configurar um link fixo do Google Meet/Zoom/Teams;
- Envia e-mails de confirmação e cancelamento com convite de calendário (.ics) anexado, compatível com Google Calendar, Outlook e Apple Calendar;
- Oferece um painel interno para o analista gerenciar tipos de reunião, disponibilidade e agendamentos.

> No MVP atual o sistema é pensado para **um único usuário** (o analista/setor de R.I.). O modelo de dados já é preparado para, no futuro, suportar mais pessoas do time sem migração estrutural.

## Stack técnica

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Prisma](https://prisma.io) + PostgreSQL
- [NextAuth](https://next-auth.js.org) (login por e-mail/senha)
- [Tailwind CSS](https://tailwindcss.com)
- [Nodemailer](https://nodemailer.com) para e-mails + pacote [`ics`](https://www.npmjs.com/package/ics) para convites de calendário
- Jitsi Meet para geração automática e gratuita de link de videochamada (sem OAuth/API key)

## Opção 1 — Rodar na máquina do R.I. (Docker, recomendado)

Requisitos: [Docker](https://docs.docker.com/get-docker/) e Docker Compose instalados.

```bash
cp .env.example .env
# edite o .env: defina NEXTAUTH_SECRET, RI_ADMIN_EMAIL, RI_ADMIN_PASSWORD e, se possível, o SMTP

docker compose up -d --build
```

Isso sobe dois containers: o banco PostgreSQL e a aplicação Next.js (porta `3000`). Na primeira subida, o container da aplicação já aplica as migrações do banco e cria o usuário definido em `RI_ADMIN_EMAIL`/`RI_ADMIN_PASSWORD` automaticamente.

Acesse:
- Página pública: http://localhost:3000
- Login do analista de R.I.: http://localhost:3000/login

Para acessar de outros computadores da rede interna, aponte para o IP da máquina (ex: `http://192.168.1.50:3000`) e ajuste `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` no `.env` de acordo.

Para expor publicamente na internet (para que investidores externos consigam agendar), a forma mais simples e gratuita é usar um túnel como o [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) apontando para a porta 3000 da máquina — sem precisar abrir portas no roteador.

### Comandos úteis

```bash
docker compose logs -f app       # ver logs da aplicação
docker compose exec app npx prisma studio   # abrir o Prisma Studio (inspecionar o banco)
docker compose down              # parar tudo (mantém os dados no volume)
```

## Opção 2 — Hospedagem gratuita (Vercel + Neon)

Alternativa sem precisar deixar nenhuma máquina ligada.

1. **Banco de dados gratuito ([Neon](https://neon.tech) ou [Supabase](https://supabase.com))**
   - Crie um projeto Postgres gratuito e copie a *connection string*.

2. **Deploy da aplicação ([Vercel](https://vercel.com), plano gratuito)**
   - Importe este repositório na Vercel.
   - Configure as variáveis de ambiente (as mesmas do `.env.example`): `DATABASE_URL` (a do Neon/Supabase), `NEXTAUTH_URL` (a URL final do projeto na Vercel), `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RI_ADMIN_EMAIL`, `RI_ADMIN_PASSWORD`, `RI_ADMIN_NAME` e, se for usar e-mails, as variáveis `SMTP_*`.
   - No comando de build, use `npx prisma migrate deploy && npm run build` (ou rode a migração manualmente uma vez, veja abaixo).

3. **Aplicar as migrações e criar o usuário** (uma única vez, a partir da sua máquina, apontando para o banco do Neon/Supabase):

   ```bash
   DATABASE_URL="<connection string do Neon/Supabase>" npx prisma migrate deploy
   DATABASE_URL="<connection string>" RI_ADMIN_EMAIL="..." RI_ADMIN_PASSWORD="..." npx prisma db seed
   ```

O plano gratuito da Vercel + Neon é suficiente para o volume de uso interno de um setor de R.I.

## Configurando envio de e-mails (SMTP)

Sem SMTP configurado, os agendamentos funcionam normalmente, mas nenhum e-mail de confirmação/cancelamento é enviado (fica registrado apenas um aviso no log). Para ativar, defina no `.env`:

```
SMTP_HOST="smtp.seuprovedor.com"
SMTP_PORT="587"
SMTP_USER="seu-usuario"
SMTP_PASSWORD="sua-senha-ou-senha-de-app"
SMTP_FROM="Relações com Investidores <ri@moreinvest.com.br>"
```

Funciona com Gmail (usando uma [senha de app](https://support.google.com/accounts/answer/185833)), Outlook/Office 365, SendGrid, Amazon SES, ou qualquer provedor SMTP.

## Desenvolvimento local

```bash
npm install
cp .env.example .env   # ajuste DATABASE_URL para um Postgres local

npx prisma migrate deploy   # ou: npx prisma migrate dev
npx prisma db seed          # cria o usuário de R.I. e tipos de reunião de exemplo

npm run dev
```

## Estrutura principal

```
prisma/schema.prisma        Modelo de dados (usuário, tipos de reunião, disponibilidade, agendamentos)
prisma/seed.ts               Script que cria o usuário único do setor de R.I.
src/lib/availability.ts      Cálculo de horários livres (disponibilidade semanal + exceções + buffers)
src/lib/video.ts             Geração do link de videochamada (Jitsi automático ou manual)
src/lib/email.ts / ics.ts    Envio de e-mails de confirmação/cancelamento com convite de calendário
src/app/(público)            Página inicial, página de agendamento (/book/[slug]) e confirmação (/booking/[uid])
src/app/dashboard             Painel interno protegido por login (tipos de reunião, disponibilidade, agendamentos, configurações)
```

## Próximos passos sugeridos (fora do MVP)

- Integração real com Google Calendar/Outlook via OAuth (para ler ocupação de agendas externas e escrever eventos automaticamente).
- Suporte a múltiplos analistas de R.I. com distribuição round-robin de agendamentos.
- Lembretes automáticos por e-mail/WhatsApp antes da call.
