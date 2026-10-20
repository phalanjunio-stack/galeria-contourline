import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  output: "standalone",
  serverExternalPackages: ["nodemailer", "pg"],
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...(process.env.ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
    "*.local",
  ],
  // Só em dev: PREVIEW_API_ORIGIN (ex: em .env.development.local) faz o preview local
  // ler eventos/fotos/thumbs de um servidor remoto, somente leitura.
  async rewrites() {
    const origin = process.env.NODE_ENV === "development" ? process.env.PREVIEW_API_ORIGIN : undefined;
    if (!origin) return [];
    return {
      beforeFiles: ["/api/eventos", "/api/fotos", "/api/thumb", "/api/eventos/dias-preview"].map((p) => ({
        source: p,
        destination: `${origin}${p}`,
      })),
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",          value: "DENY" },
          { key: "X-XSS-Protection",         value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
