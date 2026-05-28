/**
 * Agrupa fotos por data (YYYY-MM-DD) e produz uma lista de dias sintéticos
 * compatível com EventoDia, pra eventos que usam `auto_dias_por_data`.
 */
import type { EventoDia } from "@/app/api/eventos/route";

export interface FotoComData {
  id: string;
  name: string;
  data: string | null; // YYYY-MM-DD
}

export interface DiaComputado extends EventoDia {
  /** Subset de fotos do dia — preenchido só quando precisa renderizar. */
  fotos?: FotoComData[];
}

/**
 * Cria os EventoDia sintéticos a partir das fotos. Cada bucket vira um dia.
 *
 * @param folderId pasta principal do evento (todos os dias herdam ela)
 * @param fotos fotos com `data` (YYYY-MM-DD ou null)
 * @param periodo opcional — { inicio, fim } pra clamp das datas (descarta lixo fora do periodo)
 */
export function agruparPorData(
  folderId: string,
  fotos: FotoComData[],
  periodo?: { inicio?: string; fim?: string },
): DiaComputado[] {
  if (!fotos.length) return [];

  const dentroDoPeriodo = (data: string) => {
    if (periodo?.inicio && data < periodo.inicio) return false;
    if (periodo?.fim && data > periodo.fim) return false;
    return true;
  };

  // Bucket
  const buckets = new Map<string, FotoComData[]>();
  for (const f of fotos) {
    if (!f.data) continue;
    if (!dentroDoPeriodo(f.data)) continue;
    const arr = buckets.get(f.data);
    if (arr) arr.push(f);
    else buckets.set(f.data, [f]);
  }

  // Ordena por data crescente
  const datasOrdenadas = [...buckets.keys()].sort();

  return datasOrdenadas.map((data, i) => {
    const fotosDoDia = buckets.get(data)!;
    return {
      id: `dia-${data}`,
      titulo: `Dia ${i + 1}`,
      data,
      folder_id: folderId,
      total_fotos: fotosDoDia.length,
      capa_id: fotosDoDia[0]?.id,
      status: "disponivel",
      fotos: fotosDoDia,
    };
  });
}
