import type { Metadata } from "next";
import "./globals.css";

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
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
