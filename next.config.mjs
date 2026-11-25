/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
    // Las pantallas ya visitadas se muestran al instante al volver (hasta 30 s); al guardar algo se refrescan solas.
    staleTimes: { dynamic: 30, static: 180 },
  },
};
export default nextConfig;
