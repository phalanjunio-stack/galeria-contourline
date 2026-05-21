import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Galeria Contourline",
  description: "Encontre suas fotos nos eventos da Contourline",
  icons: { icon: "/logos/icon.png", apple: "/logos/icon.png" },
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('galeria-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.className} min-h-full bg-white text-[#0D2B4E]`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
