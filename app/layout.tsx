import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Galeria Contourline",
    template: "%s | Galeria Contourline",
  },
  description: "Encontre suas fotos nos eventos da Contourline com reconhecimento facial",
  icons: { icon: "/logos/icon.png", apple: "/logos/icon.png" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Contourline",
  },
  openGraph: {
    type: "website",
    siteName: "Galeria Contourline",
    locale: "pt_BR",
  },
};

export const viewport = {
  themeColor: "#2E7DD1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('galeria-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
        <link rel="dns-prefetch" href="https://www.gstatic.com" />
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
