import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { getAccessTokenFromEnv } from "@/auth";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;

export interface Notificacao {
  id: string;
  email: string;
  tipo: "fotos_encontradas" | "evento_novo" | "geral";
  titulo: string;
  mensagem: string;
  link?: string;
  thumb?: string;
  lida: boolean;
  criada_em: string;
}

async function lerTodas(token: string): Promise<Notificacao[]> {
  try {
    return await lerArquivoOculto<Notificacao[]>(ROOT, "_notificacoes.json", token) ?? [];
  } catch { return []; }
}

async function salvarTodas(notifs: Notificacao[], token: string) {
  await salvarArquivoOculto(ROOT, "_notificacoes.json", notifs, token);
}

function normalizarEmail(e: string) { return e.trim().toLowerCase(); }

// GET — notificações do usuário logado
export async function GET(req: NextRequest) {
  const session = await auth();
  const emailQuery = req.nextUrl.searchParams.get("email");
  const isAdmin = !!session?.user?.isAdmin;
  // Admin pode consultar qualquer email (pra diagnosticar).
  // Usuário comum só consulta o próprio (segurança: notif revela eventos onde aparece).
  const emailRaw = isAdmin && emailQuery
    ? emailQuery
    : (session?.user?.email ?? emailQuery);
  if (!emailRaw) return NextResponse.json([], { status: 200 });
  const email = normalizarEmail(emailRaw);

  const token = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json([], { status: 200 });

  const todas = await lerTodas(token);
  const minhas = todas
    .filter(n => normalizarEmail(n.email) === email)
    .sort((a, b) => b.criada_em.localeCompare(a.criada_em))
    .slice(0, 20);

  return NextResponse.json(minhas);
}

// POST — cria notificação (chamado internamente pelo sistema)
export async function POST(req: NextRequest) {
  const body: Omit<Notificacao, "id" | "lida" | "criada_em"> = await req.json();
  const token = await getAccessTokenFromEnv();
  if (!token) {
    console.error("[/api/notificacoes POST] getAccessTokenFromEnv retornou null — Drive sem acesso. Admin precisa relogar via Google.");
    return NextResponse.json({ error: "Sem token Drive (admin precisa relogar)" }, { status: 401 });
  }

  const todas = await lerTodas(token);
  const nova: Notificacao = {
    ...body,
    email: normalizarEmail(body.email),
    id: crypto.randomUUID(),
    lida: false,
    criada_em: new Date().toISOString(),
  };
  todas.push(nova);
  // Mantém só as 200 mais recentes
  todas.sort((a, b) => b.criada_em.localeCompare(a.criada_em));
  await salvarTodas(todas.slice(0, 200), token);

  return NextResponse.json(nova);
}

// PATCH — marca como lida (por id ou todas do email)
export async function PATCH(req: NextRequest) {
  const { id, email, todas } = await req.json();
  const token = (await auth())?.accessToken ?? await getAccessTokenFromEnv();
  if (!token) return NextResponse.json({ error: "Sem token" }, { status: 401 });

  const emailNorm = email ? normalizarEmail(email) : null;
  const notifs = await lerTodas(token);
  notifs.forEach(n => {
    if (todas && emailNorm && normalizarEmail(n.email) === emailNorm) { n.lida = true; return; }
    if (n.id === id) n.lida = true;
  });
  await salvarTodas(notifs, token);
  return NextResponse.json({ ok: true });
}
