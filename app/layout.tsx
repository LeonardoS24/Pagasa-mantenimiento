import type { Metadata } from "next";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
