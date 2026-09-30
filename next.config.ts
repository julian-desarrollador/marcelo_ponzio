import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Raíz explícita: si hay otro package-lock.json en un padre (p. ej. el perfil de usuario),
// Turbopack puede elegir mal y compilación dev queda colgada o muy lenta.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingIncludes: {
    "/api/panel-turnos/recompensas/gift-cards/[id]/imagen": ["./src/lib/rewards/fonts/**/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/favicon-64.png?v=2",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
