import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;
const FILE_NAME = "_event_metrics.json";

type MetricKey = "views" | "likes" | "shares";

type Metrics = {
  views: number;
  likes: number;
  shares: number;
  updatedAt?: string;
};

type MetricsIndex = Record<string, Metrics>;

function emptyMetrics(): Metrics {
  return { views: 0, likes: 0, shares: 0 };
}

function sanitizeSlug(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

function sanitizeMetric(value: unknown): MetricKey | null {
  return value === "views" || value === "likes" || value === "shares" ? value : null;
}

async function getToken(sessionToken?: string) {
  return (await getAccessTokenFromEnv()) ?? sessionToken ?? null;
}

async function lerMetricas(token: string): Promise<MetricsIndex> {
  const data = await lerArquivoOculto<MetricsIndex>(ROOT_FOLDER, FILE_NAME, token).catch(() => null);
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

async function salvarMetricas(index: MetricsIndex, token: string) {
  await salvarArquivoOculto(ROOT_FOLDER, FILE_NAME, index, token);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const token = await getToken(session?.accessToken);
  if (!token) return NextResponse.json({ error: "Sem token do Drive" }, { status: 401 });

  const slug = sanitizeSlug(req.nextUrl.searchParams.get("slug"));
  const index = await lerMetricas(token);

  if (slug) {
    return NextResponse.json(index[slug] ?? emptyMetrics());
  }

  return NextResponse.json(index);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const token = await getToken(session?.accessToken);
  if (!token) return NextResponse.json({ error: "Sem token do Drive" }, { status: 401 });

  try {
    const body = await req.json() as Record<string, unknown>;
    const slug = sanitizeSlug(body.slug);
    const metric = sanitizeMetric(body.metric);

    if (!slug || !metric) {
      return NextResponse.json({ error: "slug e metric obrigatorios" }, { status: 400 });
    }

    const index = await lerMetricas(token);
    const atual = index[slug] ?? emptyMetrics();
    const next = {
      ...atual,
      [metric]: Math.max(0, Number(atual[metric] ?? 0)) + 1,
      updatedAt: new Date().toISOString(),
    };

    index[slug] = next;
    await salvarMetricas(index, token);

    return NextResponse.json(next);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
