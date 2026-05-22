import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resultado da busca facial",
  description: "Veja as fotos encontradas para você com reconhecimento facial nos eventos da Contourline.",
  robots: { index: false },
};

export default function ResultadoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
