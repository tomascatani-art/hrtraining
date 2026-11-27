/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
    // Las pantallas ya visitadas se muestran al instante al volver (hasta 90 s); al guardar algo se refrescan solas.
    staleTimes: { dynamic: 90, static: 300 },
  },
};
export default nextConfig;
