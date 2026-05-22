import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eventos",
  description: "Confira todos os eventos fotográficos da Contourline.",
};

export default function EventosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
