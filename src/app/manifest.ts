import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hrtraining.co",
    short_name: "Hrtraining",
    description: "Planificación, evaluaciones y control de cargas para entrenadores y alumnos.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
