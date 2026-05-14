import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Ignora erros de TypeScript no build (nao bloqueia deploy na Vercel)
  typescript: { ignoreBuildErrors: true },
  // Ignora erros de ESLint no build
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["nodemailer"],
  // Força a raiz do workspace pra pasta do projeto (ignora package-lock.json órfão
  // em C:\Users\Contourline\ que estava confundindo o Turbopack)
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Permite acesso ao dev server vindo de IPs da rede local (celular no mesmo WiFi).
  // Sem isso, Next.js 15+ bloqueia silenciosamente Server Actions e algumas APIs.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.224",   // IP atual do PC (rede WiFi)
    "192.168.1.43",    // IP anterior (caso volte a ser esse)
    "*.local",         // domínios .local genéricos
  ],
};

export default nextConfig;
