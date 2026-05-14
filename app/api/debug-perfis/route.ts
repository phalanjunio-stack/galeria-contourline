import { NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;
const DRIVE_API = "https://www.googleapis.com/drive/v3";

export async function GET() {
  const session = await auth();
  const result: Record<string, unknown> = {
    ROOT_FOLDER_ID: ROOT ?? "NÃO CONFIGURADO",
    GOOGLE_REFRESH_TOKEN_SET: !!process.env.GOOGLE_REFRESH_TOKEN,
    session_email: session?.user?.email ?? null,
    session_isAdmin: session?.user?.isAdmin ?? false,
  };

  // 1. Testa geração de token via service account
  const serviceToken = await getAccessTokenFromEnv();
  result.service_token_ok = !!serviceToken;
  result.service_token_prefix = serviceToken ? serviceToken.slice(0, 20) + "..." : null;

  const oauthToken = session?.accessToken as string | undefined;
  result.oauth_token_ok = !!oauthToken;

  // 2. Testa listagem da pasta com service token
  if (serviceToken && ROOT) {
    try {
      const r = await fetch(
        `${DRIVE_API}/files?q='${ROOT}' in parents and trashed=false&fields=files(id,name,mimeType)&pageSize=50`,
        { headers: { Authorization: `Bearer ${serviceToken}` } }
      );
      const data = await r.json();
      result.drive_list_status = r.status;
      result.drive_list_ok = r.ok;
      if (r.ok) {
        result.arquivos_na_pasta = (data.files ?? []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }));
        result.total_arquivos = data.files?.length ?? 0;
        const perfisFile = data.files?.find((f: { name: string }) => f.name === "_perfis.json");
        result.perfis_json_encontrado = !!perfisFile;
        result.perfis_json_id = perfisFile?.id ?? null;

        if (perfisFile) {
          const contentRes = await fetch(
            `${DRIVE_API}/files/${perfisFile.id}?alt=media`,
            { headers: { Authorization: `Bearer ${serviceToken}` } }
          );
          result.perfis_read_status = contentRes.status;
          if (contentRes.ok) {
            const perfis = await contentRes.json();
            result.perfis_count = Array.isArray(perfis) ? perfis.length : "não é array";
            result.perfis_emails = Array.isArray(perfis)
              ? perfis.map((p: { email: string; nome: string; descriptor?: unknown[] }) => ({
                  email: p.email,
                  nome: p.nome,
                  tem_descriptor: Array.isArray(p.descriptor) && p.descriptor.length > 0,
                }))
              : null;
          } else {
            result.perfis_read_error = await contentRes.text();
          }
        }
      } else {
        result.drive_list_error = data;
      }
    } catch (e) {
      result.drive_exception = String(e);
    }
  }

  // 3. Testa escrita de arquivo de teste
  if (serviceToken && ROOT) {
    try {
      const testName = "_test_conexao.json";
      const content  = JSON.stringify({ ok: true, ts: Date.now() });

      const searchRes = await fetch(
        `${DRIVE_API}/files?q='${ROOT}' in parents and name='${testName}' and trashed=false&fields=files(id)`,
        { headers: { Authorization: `Bearer ${serviceToken}` } }
      );
      const searchData = await searchRes.json();
      const existingId = searchData.files?.[0]?.id;

      let writeRes: Response;
      if (existingId) {
        writeRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
            body: content,
          }
        );
      } else {
        const meta = JSON.stringify({ name: testName, parents: [ROOT] });
        const form = new FormData();
        form.append("metadata", new Blob([meta], { type: "application/json" }));
        form.append("file", new Blob([content], { type: "application/json" }));
        writeRes = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          { method: "POST", headers: { Authorization: `Bearer ${serviceToken}` }, body: form }
        );
      }
      result.write_test_status = writeRes.status;
      result.write_test_ok = writeRes.ok;
      if (!writeRes.ok) result.write_test_error = await writeRes.text();
    } catch (e) {
      result.write_test_exception = String(e);
    }
  }

  return NextResponse.json(result, { status: 200 });
}
