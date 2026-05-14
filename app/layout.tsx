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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} min-h-full bg-white text-[#0D2B4E]`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
