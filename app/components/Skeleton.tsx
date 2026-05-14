"use client";

/**
 * Skeleton — silhuetas animadas pra usar enquanto dados carregam.
 * Mais profissional que spinners genéricos.
 */

export function SkeletonBox({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={`bg-gradient-to-br from-[#1A4A80]/15 via-[#2E7DD1]/10 to-[#1A4A80]/15 rounded-xl animate-pulse ${className}`}
    />
  );
}

/** Grid de cards de evento (página /eventos) */
export function SkeletonEventos({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-[4/5] rounded-2xl overflow-hidden bg-white shadow"
          style={{ animationDelay: `${i * 60}ms` }}>
          <SkeletonBox className="w-full h-full !rounded-none" />
        </div>
      ))}
    </div>
  );
}

/** Grid masonry de fotos (galeria, minhas-fotos) */
export function SkeletonFotos({ count = 12 }: { count?: number }) {
  // Alturas variadas pra simular grid masonry de proporções diferentes
  const alturas = [180, 220, 160, 240, 200, 180, 260, 200, 180, 220, 200, 180];
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="break-inside-avoid mb-3 rounded-xl overflow-hidden">
          <SkeletonBox
            className="w-full !rounded-xl"
            style={{ height: `${alturas[i % alturas.length]}px`, animationDelay: `${i * 50}ms` } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}

/** Linha de cards horizontais (banner MinhasFotos, scroll) */
export function SkeletonRow({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBox key={i}
          className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32"
          style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Bloco de texto (linhas) */
export function SkeletonTexto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <SkeletonBox key={i}
          className="h-3 !rounded-md"
          style={{ width: `${100 - i * 12}%` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Adapter pra aceitar style inline */
declare module "react" {
  interface CSSProperties {
    "--delay"?: string;
  }
}
