import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

// Misma tipografía que grupopagasa.com.mx (Roboto en encabezados y cuerpo).
// next/font la auto-hospeda en la compilación, así que no depende de que el
// equipo del usuario la tenga instalada ni de una petición a Google en vivo.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-roboto",
});

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
    <html lang="es" className={roboto.variable}>
      <body className="bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
