import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import BottomBar from "../components/BottomBar";
import ScrollToTop from "../components/ScrollToTop";
import Footer from "../components/Footer";
import InfoModais from "../components/InfoModais";
import StatusDock from "../components/StatusDock";
import { ToastProvider } from "../components/ToastProvider";

export const metadata: Metadata = {
  title: {
    template: "%s — Galeria Contourline",
    default: "Galeria Contourline",
  },
  description: "Encontre suas fotos nos eventos da Contourline com reconhecimento facial.",
  openGraph: {
    siteName: "Galeria Contourline",
    locale: "pt_BR",
    type: "website",
  },
};

// Página renderizada UMA vez (antes havia uma cópia desktop e outra mobile
// montadas juntas, o que duplicava todas as requisições de cada página).
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="site-page flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1 pt-16 pb-24 lg:pb-0">
          {children}
        </main>
        <Footer />

        <BottomBar />
        <ScrollToTop />
        <InfoModais />
        <StatusDock />
      </div>
    </ToastProvider>
  );
}
