import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Força Node.js runtime — auth.ts usa fs/path que nao existem no Edge Runtime
export const runtime = "nodejs";

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
