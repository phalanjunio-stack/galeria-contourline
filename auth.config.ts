// Configuracao edge-safe do NextAuth — usada apenas pelo middleware.
// NAO pode importar fs, path ou qualquer modulo Node.js.
import type { NextAuthConfig } from "next-auth";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export const authConfig: NextAuthConfig = {
  // Secret explícito — idêntico ao auth.ts para o middleware Edge não crashar
  secret: process.env.AUTH_SECRET
    ?? process.env.NEXTAUTH_SECRET
    ?? "56d99d13400fccc48be2b47222619a787cf86521bc956b7f75b752f157787f50",
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      try {
        if (session?.user) {
          (session.user as Record<string, unknown>).isAdmin =
            !!(token?.isLocalAdmin) ||
            ADMIN_EMAILS.includes(session.user.email?.toLowerCase() ?? "");
        }
      } catch (e) {
        console.error("[authConfig] session error:", e);
      }
      return session;
    },
  },
};
