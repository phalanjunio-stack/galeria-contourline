// Configuracao edge-safe do NextAuth — usada apenas pelo middleware.
// NAO pode importar fs, path ou qualquer modulo Node.js.
import type { NextAuthConfig } from "next-auth";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export const authConfig: NextAuthConfig = {
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
