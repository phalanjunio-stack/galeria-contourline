import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import sharp from "sharp";
import path from "path";
import fs from "fs";

// Prepara logo com fundo transparente e cor branca para uso como watermark
async function gerarLogoWatermark(larguraFoto: number): Promise<Buffer> {
  const logoPath = path.join(process.cwd(), "public", "logos", "logo.png");
  const logoRaw  = fs.readFileSync(logoPath);

  // Largura do watermark = 25% da foto, mínimo 200px
  const wm = Math.max(200, Math.round(larguraFoto * 0.25));

  // Estratégia: extrai só os pixels escuros (o desenho) e os torna brancos semitransparentes
  // 1. Redimensiona
  // 2. Garante fundo branco puro
  // 3. Converte para RGBA
  // 4. Para cada pixel: quanto mais escuro, mais opaco e branco ele fica; branco vira transparente
  const { data, info } = await sharp(logoRaw)
    .resize(wm, null, { fit: "inside" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    // Luminância: 0=preto, 255=branco
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Escuridão: 0=branco, 255=preto
    const escuro = 255 - lum;
    // Pixel vira branco com opacidade proporcional à escuridão × 50%
    pixels[i]     = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(escuro * 0.55); // 55% no máximo
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

// GET /api/download?id=FILE_ID  → full resolution com marca d'água
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  const session = await auth();
  // Service account primeiro — sempre fresco; OAuth expira em 1 hora
  const accessToken = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!accessToken) return new NextResponse("Sem token de acesso", { status: 401 });

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return new NextResponse("Erro ao buscar imagem", { status: res.status });

    const buffer = Buffer.from(await res.arrayBuffer());

    // Auto-rotaciona pela orientação EXIF (corrige fotos de celular viradas)
    const rotated = await sharp(buffer).rotate().toBuffer();

    const meta = await sharp(rotated).metadata();
    const w    = meta.width ?? 1920;

    const logoWm = await gerarLogoWatermark(w);

    const resultado = await sharp(rotated)
      .composite([{
        input:   logoWm,
        gravity: "south",   // centralizado na parte inferior
        blend:   "over",    // logo tem canal alpha real agora → sem caixa
      }])
      .jpeg({ quality: 92 })
      .toBuffer();

    // Tenta pegar o nome do arquivo original para usar no download
    const nomeMeta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).then(r => r.ok ? r.json() : null).catch(() => null);
    const nomeArquivo = nomeMeta?.name ?? `foto-contourline.jpg`;

    return new NextResponse(resultado, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Erro interno", { status: 500 });
  }
}
