import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromEnv } from "@/auth";

function authorized(req: NextRequest) {
  const secret = process.env.FACE_SERVER_SECRET;
  return !!secret && req.headers.get("x-server-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const token = await getAccessTokenFromEnv();
  if (!token) {
    return NextResponse.json({ error: "Drive sem access token" }, { status: 503 });
  }

  return NextResponse.json({ accessToken: token });
}
