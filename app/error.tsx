"use client";

import { PantallaDeError } from "@/components/layout/PantallaDeError";

// Errores fuera del área protegida (login, cambio de contraseña).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaDeError error={error} reset={reset} conMenu={false} />;
}
