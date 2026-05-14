// Middleware edge-safe: usa authConfig (sem fs/path) em vez do auth.ts completo
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Rotas admin → exige login + ser admin
  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?next=/admin", req.url));
    }
    if (!session.user?.isAdmin) {
      return NextResponse.redirect(new URL("/acesso-negado", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
