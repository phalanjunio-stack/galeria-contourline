import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

// ─── Helpers de arquivo (dynamic import — não executa no Edge) ────────────────
async function lerTokenDisco() {
  try {
    const { existsSync, readFileSync } = await import("fs");
    const { join } = await import("path");
    const p = join(process.cwd(), "data", "server_token.json");
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8")) as {
      access_token: string; refresh_token?: string; expires_at: number;
    };
  } catch { return null; }
}

async function salvarTokenDisco(t: { access_token: string; refresh_token?: string; expires_at: number }) {
  try {
    const { writeFileSync, mkdirSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const p = join(process.cwd(), "data", "server_token.json");
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(p, JSON.stringify(t), "utf-8");
  } catch { /**/ }
}

async function trocarRefreshToken(refreshToken: string) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    if (!data.access_token) return null;
    return {
      access_token:  data.access_token as string,
      refresh_token: (data.refresh_token ?? refreshToken) as string,
      expires_at:    Math.floor(Date.now() / 1000) + ((data.expires_in as number) ?? 3600) - 120,
    };
  } catch { return null; }
}

// Obtém token sempre válido para acesso ao Drive server-side.
// Estratégia:
//   1. GOOGLE_REFRESH_TOKEN do .env é fonte de verdade (conta dona da pasta raiz).
//      Usa o disco SÓ como cache de access_token enquanto vale (evita 1 round-trip).
//   2. Se o cache em disco veio de um refresh DIFERENTE do env (ex: login OAuth de
//      outro admin que sobrescreveu o arquivo), ignora e renova com o env.
//   3. Disco como fallback apenas se o env não estiver definido (raro).
export async function getAccessTokenFromEnv(): Promise<string | null> {
  const agora = Math.floor(Date.now() / 1000);
  const envRefresh = process.env.GOOGLE_REFRESH_TOKEN;
  const cached = await lerTokenDisco();

  // 1. Se o env existe E o disco tem token desse mesmo refresh, reusa enquanto valido
  if (envRefresh && cached?.refresh_token === envRefresh
      && cached.access_token && cached.expires_at > agora) {
    return cached.access_token;
  }

  // 2. Renova com env_refresh (fonte de verdade)
  if (envRefresh) {
    const novo = await trocarRefreshToken(envRefresh);
    if (novo) { await salvarTokenDisco(novo); return novo.access_token; }
  }

  // 3. Sem env — cai pro disco (legado)
  if (cached?.access_token && cached.expires_at > agora) return cached.access_token;
  if (cached?.refresh_token) {
    const novo = await trocarRefreshToken(cached.refresh_token);
    if (novo) { await salvarTokenDisco(novo); return novo.access_token; }
  }

  return null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Confia no Host vindo do proxy (Traefik/Nginx)
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),

    Credentials({
      id: "local",
      name: "Senha local",
      credentials: { password: { label: "Senha", type: "password" } },
      async authorize(credentials) {
        const senha = process.env.ADMIN_PASSWORD;
        if (!senha || credentials?.password !== senha) return null;
        return { id: "local-admin", name: "Admin", email: process.env.ADMIN_EMAILS?.split(",")[0] ?? "admin@local" };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      try { /* jwt ok */ } catch(e) { console.error("[auth] jwt error:", e); }
      // ── Login Google ──────────────────────────────────────────────
      if (account?.provider === "google") {
        token.accessToken  = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt    = account.expires_at;

        // Salva em disco se for admin → todos os usuários passam a usar este token
        const email = (token.email ?? "") as string;
        if (ADMIN_EMAILS.includes(email.toLowerCase()) && account.access_token) {
          await salvarTokenDisco({
            access_token:  account.access_token,
            refresh_token: account.refresh_token,
            expires_at:    (account.expires_at as number) ?? Math.floor(Date.now() / 1000) + 3500,
          });
          console.log("\x1b[32m✓ Token admin salvo em disco — Drive ativo para todos os usuários\x1b[0m");
        }
      }

      // ── Login local ───────────────────────────────────────────────
      if (account?.provider === "local") {
        token.isLocalAdmin = true;
        token.accessToken  = await getAccessTokenFromEnv();
      }

      // ── Renova token expirado (Google OAuth) ──────────────────────
      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() / 1000 > expiresAt - 60 && token.refreshToken) {
        const novo = await trocarRefreshToken(token.refreshToken as string);
        if (novo) {
          token.accessToken = novo.access_token;
          token.expiresAt   = novo.expires_at;
          // Atualiza disco se for admin
          const email = (token.email ?? "") as string;
          if (ADMIN_EMAILS.includes(email.toLowerCase())) {
            await salvarTokenDisco({ ...novo, refresh_token: novo.refresh_token ?? token.refreshToken as string });
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      try {
        session.accessToken  = token.accessToken as string;
        if (session.user) {
          session.user.isAdmin = !!(token.isLocalAdmin) ||
            ADMIN_EMAILS.includes(session.user.email?.toLowerCase() ?? "");
        }
      } catch (err) {
        console.error("[auth] session callback error:", err);
      }
      return session;
    },
  },

  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
