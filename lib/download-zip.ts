// Baixa um conjunto de fotos do Drive como um único arquivo ZIP com marca d'água

// Carrega a logo uma vez e cacheia
let logoCache: HTMLImageElement | null = null;
function carregarLogo(): Promise<HTMLImageElement> {
  if (logoCache) return Promise.resolve(logoCache);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { logoCache = img; resolve(img); };
    img.onerror = reject;
    img.src = "/logos/logo.png";
  });
}

async function aplicarMarcaDagua(blob: Blob): Promise<Blob> {
  return new Promise(async (resolve) => {
    const foto = new Image();
    const url  = URL.createObjectURL(blob);

    foto.onload = async () => {
      try {
        const W = foto.naturalWidth;
        const H = foto.naturalHeight;

        const canvas = document.createElement("canvas");
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;

        ctx.drawImage(foto, 0, 0);
        URL.revokeObjectURL(url);

        // Logo discreta: 10% da largura, canto inferior direito
        const logo  = await carregarLogo();
        const ratio = logo.naturalHeight / logo.naturalWidth;
        const wmW   = Math.max(80, Math.round(W * 0.10));
        const wmH   = Math.round(wmW * ratio);
        const pad   = Math.round(W * 0.02);
        const xLogo = W - wmW - pad;
        const yLogo = H - wmH - pad;

        ctx.globalAlpha = 0.28;
        ctx.drawImage(logo, xLogo, yLogo, wmW, wmH);
        ctx.globalAlpha = 1;

        canvas.toBlob((b) => resolve(b ?? blob), "image/jpeg", 0.92);
      } catch {
        URL.revokeObjectURL(url);
        resolve(blob);
      }
    };
    foto.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    foto.src = url;
  });
}

/** Atalho: gera nome do arquivo a partir do nome do evento e baixa o ZIP. */
export async function baixarFotosZip(ids: string[], nomeEvento?: string) {
  const slug = (nomeEvento ?? "contourline")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\w-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "fotos";
  return baixarComoZip(ids, `fotos-${slug}.zip`);
}

export async function baixarComoZip(ids: string[], nomeArquivo = "fotos-contourline.zip") {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // Baixa todas as fotos em paralelo (lotes de 5 para não sobrecarregar)
  const LOTE = 5;
  let contador = 0;

  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    await Promise.all(lote.map(async (id) => {
      try {
        const res = await fetch(`/api/download?id=${id}`);
        if (!res.ok) return;
        const blob = await res.blob();
        const comMarca = await aplicarMarcaDagua(blob);
        contador++;
        zip.file(`foto-${contador}.jpg`, comMarca);
      } catch { /**/ }
    }));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
