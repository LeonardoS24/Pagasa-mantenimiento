"use client";

import { PantallaDeError } from "@/components/layout/PantallaDeError";

// Error dentro del sistema: queda el encabezado y el menú lateral (el layout
// de (protected) no se reemplaza), solo se cambia el contenido de la página.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaDeError error={error} reset={reset} conMenu />;
}
