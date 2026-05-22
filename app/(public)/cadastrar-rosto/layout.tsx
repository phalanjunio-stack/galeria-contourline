import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cadastrar rosto",
  description: "Cadastre seu rosto para encontrar suas fotos automaticamente nos eventos da Contourline.",
};

export default function CadastrarRostoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
