import { NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerStatusFaceIndexDb } from "@/lib/face-index-db";

async function testarFaceServer() {
  const url = process.env.FACE_SERVER_URL;
  if (!url) return { configured: false, ok: false };
  try {
    const res = await fetch(url, { cache: "no-store" });
    return { configured: true, ok: res.ok, status: res.status };
  } catch (err) {
    return { configured: true, ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const [driveToken, faceIndex, faceServer] = await Promise.all([
    getAccessTokenFromEnv().catch(() => null),
    lerStatusFaceIndexDb(),
    testarFaceServer(),
  ]);

  return NextResponse.json({
    app: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      gitSha: process.env.GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      version: process.env.npm_package_version ?? null,
      now: new Date().toISOString(),
    },
    env: {
      nextAuthUrl: Boolean(process.env.NEXTAUTH_URL),
      googleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      driveRootFolderId: Boolean(process.env.DRIVE_ROOT_FOLDER_ID),
      databaseUrl: Boolean(process.env.DATABASE_URL),
      faceServerUrl: Boolean(process.env.FACE_SERVER_URL),
    },
    services: {
      drive: { configured: Boolean(process.env.DRIVE_ROOT_FOLDER_ID), ok: Boolean(driveToken) },
      faceIndex,
      faceServer,
    },
  });
}
