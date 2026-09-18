import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_HOURS = { start: "09:00", end: "18:00" };

async function main() {
  const email = process.env.RI_ADMIN_EMAIL;
  const password = process.env.RI_ADMIN_PASSWORD;
  const name = process.env.RI_ADMIN_NAME ?? "Relações com Investidores";

  if (!email || !password) {
    throw new Error(
      "Defina RI_ADMIN_EMAIL e RI_ADMIN_PASSWORD no .env antes de rodar o seed.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    update: { name, passwordHash },
    create: {
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      timezone: "America/Sao_Paulo",
    },
  });

  const existingAvailability = await prisma.weeklyAvailability.count({
    where: { userId: user.id },
  });

  if (existingAvailability === 0) {
    // Segunda a sexta, horário comercial padrão.
    await prisma.weeklyAvailability.createMany({
      data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        userId: user.id,
        dayOfWeek,
        startTime: DEFAULT_HOURS.start,
        endTime: DEFAULT_HOURS.end,
      })),
    });
  }

  const existingEventTypes = await prisma.eventType.count({ where: { userId: user.id } });

  if (existingEventTypes === 0) {
    await prisma.eventType.createMany({
      data: [
        {
          userId: user.id,
          title: "Call rápida com R.I.",
          slug: "call-rapida",
          description: "Dúvidas pontuais sobre resultados, guidance ou dados públicos da companhia.",
          durationMinutes: 15,
          color: "#3a5ce6",
          position: 0,
        },
        {
          userId: user.id,
          title: "Reunião com investidor",
          slug: "reuniao-investidor",
          description: "Conversa mais completa com o time de Relações com Investidores.",
          durationMinutes: 30,
          color: "#2a44c0",
          position: 1,
        },
        {
          userId: user.id,
          title: "Reunião de resultados trimestrais",
          slug: "resultados-trimestrais",
          description: "Apresentação e discussão dos resultados do trimestre.",
          durationMinutes: 60,
          color: "#1f2f7a",
          position: 2,
        },
      ],
    });
  }

  console.log(`Usuário de R.I. pronto: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
