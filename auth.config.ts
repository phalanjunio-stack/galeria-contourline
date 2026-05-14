// Configuracao edge-safe do NextAuth — usada apenas pelo middleware.
// NAO pode importar fs, path ou qualquer modulo Node.js.
import type { NextAuthConfig } from "next-auth";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [], // providers completos ficam em auth.ts
  callbacks: {
    // Reconstroi session.user.isAdmin a partir do token JWT (sem fs)
    async session({ session, token }) {
      session.user.isAdmin =
        !!(token.isLocalAdmin) ||
        ADMIN_EMAILS.includes(session.user.email?.toLowerCase() ?? "");
      return session;
    },
  },
};
