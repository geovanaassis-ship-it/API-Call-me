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

## Integração com Outlook/Teams (Microsoft Graph)

Opcional. Sem configurar isso, o sistema funciona normalmente com uma agenda própria e interna (o padrão). Com a integração ativada, o analista de R.I. conecta sua conta Microsoft e passa a ter:

- Um link único do Microsoft Teams gerado automaticamente para cada agendamento (em vez de um link fixo reutilizado);
- Checagem de conflito com compromissos reais do Outlook do analista, além da disponibilidade configurada no sistema;
- Criação automática do evento na agenda do Outlook do analista, sem precisar abrir o anexo `.ics` manualmente.

### 1. Registrar o aplicativo no Azure AD (feito pelo TI/administrador do Microsoft 365)

1. Acesse [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Nome: `Agenda R.I. - More Invest` (ou o que preferir). Tipo de conta: **Single tenant** (só contas da própria organização).
3. Em **Redirect URI**, escolha plataforma **Web** e cole exatamente:
   ```
   https://SEU-DOMINIO-NO-VERCEL/api/integrations/microsoft/callback
   ```
   (troque `SEU-DOMINIO-NO-VERCEL` pelo domínio real do site, ex: `api-call-me.vercel.app`).
4. Depois de criado, vá em **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**, e adicione:
   - `Calendars.ReadWrite`
   - `OnlineMeetings.ReadWrite`
   - `User.Read` (geralmente já vem por padrão)
   - `offline_access` (geralmente já vem por padrão)

   Essas são permissões **delegadas** (não "Application permissions") — ou seja, só dão acesso à conta de quem faz login e autoriza, nunca à organização inteira.
5. Clique em **Grant admin consent for [organização]** (evita que cada usuário precise aprovar individualmente).
6. Vá em **Certificates & secrets** → **New client secret**, copie o **valor** gerado (só aparece uma vez).
7. Volte em **Overview** e anote o **Application (client) ID** e o **Directory (tenant) ID**.

### 2. Configurar as variáveis de ambiente

No Vercel (ou no `.env`, se rodando localmente):

```
ENCRYPTION_KEY="<gere com: openssl rand -base64 32>"
MICROSOFT_CLIENT_ID="<Application (client) ID>"
MICROSOFT_CLIENT_SECRET="<valor do client secret>"
MICROSOFT_TENANT_ID="<Directory (tenant) ID>"
```

### 3. Conectar a conta

Com as variáveis configuradas (e o site reiniciado/redeployado), acesse **Configurações → Integração Microsoft (Outlook / Teams)** no painel, clique em **Conectar conta Microsoft**, faça login com a conta do analista de R.I. e autorize.

Depois disso, crie ou edite um tipo de reunião e escolha **"Microsoft Teams (automático, requer conta conectada)"** em Local/Videochamada.

### Revogar o acesso

A qualquer momento, o TI pode revogar em **Azure AD → Enterprise Applications → Agenda R.I. → Delete**, ou o próprio analista pode desconectar em **Configurações → Desconectar conta Microsoft** no painel. Isso não afeta nenhuma outra funcionalidade do sistema — ele volta a usar a agenda interna normalmente.

## Segurança e privacidade

O sistema lida com dados pessoais de investidores (nome, e-mail, telefone), então algumas proteções já vêm implementadas:

- **Bloqueio de conta após tentativas de login incorretas**: depois de 5 tentativas erradas seguidas, a conta fica bloqueada por 15 minutos. Há também um limite de tentativas por endereço IP.
- **Limite de agendamentos por IP e por e-mail**: a página pública de agendamento aceita no máximo 8 tentativas de agendamento por IP a cada 15 minutos, e 5 por e-mail de convidado a cada hora — evita que alguém encha a agenda de propósito.
- **Aviso de LGPD** na página de agendamento, informando ao convidado quais dados são coletados e para qual finalidade.
- Senhas armazenadas com hash bcrypt (nunca em texto puro); áreas administrativas protegidas por login; links de cancelamento usam identificadores longos e imprevisíveis.
- Tokens da integração Microsoft (se conectada) são criptografados (AES-256-GCM) antes de ir para o banco, nunca guardados em texto puro.

Pontos que dependem de você, não de código:

- **Não compartilhe o login das suas contas Neon e Vercel.** Quem tiver acesso a elas consegue ver a connection string do banco (e, portanto, os dados dos agendamentos) e as variáveis de ambiente (incluindo `NEXTAUTH_SECRET`). Ative autenticação em duas etapas (2FA) nessas contas se possível.
- Se em algum momento desconfiar que o `NEXTAUTH_SECRET` ou a senha do banco vazaram, gere valores novos e atualize as variáveis de ambiente na Vercel.
- Use uma senha forte e exclusiva para o login do painel (`/login`), e troque-a periodicamente em **Configurações → Trocar senha**.
- Este é um sistema para uso interno de baixo volume — não foi projetado nem testado para resistir a ataques direcionados e sofisticados. Para um volume alto de tráfego público ou dados mais sensíveis, vale considerar uma revisão de segurança mais aprofundada antes de divulgar o link amplamente.

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
