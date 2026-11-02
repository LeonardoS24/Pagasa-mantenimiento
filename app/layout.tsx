import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarApp } from "@/components/layout/RegistrarApp";

// Misma tipografía que grupopagasa.com.mx (Roboto), pero SIN next/font/google:
// esa opción descarga la fuente desde Google al compilar y este equipo no
// tiene salida a internet, así que cada compilación se quedaba esperando el
// tiempo de espera completo antes de rendirse y usar la de respaldo — eran
// segundos de más en cada carga de página. Ahora se pide la Roboto instalada
// en el equipo y, si no está, se cae a la tipografía del sistema (ver
// tailwind.config.ts: fontFamily.sans).

export const metadata: Metadata = {
  title: "Sistema Integral de Mantenimiento — Pagasa",
  description: "Sistema interno de mantenimiento por ciudad y sede",
  // Para "Agregar a pantalla de inicio" en el celular (ver app/manifest.ts).
  appleWebApp: { capable: true, title: "Mantenimiento", statusBarStyle: "default" },
  icons: { icon: "/logos/icono-192.png", apple: "/logos/apple-touch-icon.png" },
};

// Ancho del teléfono y barra del navegador con el azul del sistema.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#054095",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 font-sans">
        {children}
        <RegistrarApp />
      </body>
    </html>
  );
}
