import type { MetadataRoute } from "next";

// Para instalar el sistema como app en el celular ("Agregar a pantalla de
// inicio"): ícono propio y se abre a pantalla completa, sin la barra del
// navegador. Ver components/layout/RegistrarApp.tsx y public/sw.js.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistema Integral de Mantenimiento — Pagasa",
    short_name: "Mantenimiento",
    description: "Mantenimiento de flota, estaciones y plantas de gas LP de Grupo Pagasa",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#054095",
    lang: "es-MX",
    icons: [
      { src: "/logos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/logos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
