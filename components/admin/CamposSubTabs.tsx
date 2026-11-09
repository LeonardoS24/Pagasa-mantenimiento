"use client";

import { SubPestanas } from "./SubPestanas";

// Editar sistema: todo lo que el ADMIN cambia sin tocar el código. Alertas y
// Normas viven en sus propias pestañas; aquí van también para encontrarlas.
export function CamposSubTabs() {
  return (
    <SubPestanas
      pestanas={[
        { href: "/admin/campos/acomodar", label: "Fichas de unidades" },
        { href: "/admin/campos", label: "Estaciones, planta y lista de campos", exacto: true },
        { href: "/admin/alertas/configurar", label: "Alertas" },
        { href: "/admin/normas", label: "Normas y términos de referencia" },
      ]}
    />
  );
}
