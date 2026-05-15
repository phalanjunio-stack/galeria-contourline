import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignora erros de TypeScript no build
  typescript: { ignoreBuildErrors: true },
  // Standalone: bundle mínimo para Docker (inclui server.js)
  output: "standalone",
  serverExternalPackages: ["nodemailer"],
  // Permite acesso ao dev server vindo de IPs da rede local (celular no mesmo WiFi).
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.224",
    "192.168.1.43",
    "*.local",
  ],
};

export default nextConfig;
