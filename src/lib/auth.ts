import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_ATTEMPTS = 20; // por IP, somando tentativas contra qualquer conta

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = getClientIp(req?.headers as Headers | Record<string, unknown> | undefined);
        const ipCheck = await checkRateLimit(`login:ip:${ip}`, { windowMs: IP_WINDOW_MS, max: IP_MAX_ATTEMPTS });
        if (!ipCheck.allowed) {
          throw new Error("Muitas tentativas de login a partir deste endereço. Aguarde alguns minutos e tente novamente.");
        }

        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("Conta temporariamente bloqueada após várias tentativas incorretas. Tente novamente mais tarde.");
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: shouldLock ? 0 : attempts,
              lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MS) : null,
            },
          });
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
