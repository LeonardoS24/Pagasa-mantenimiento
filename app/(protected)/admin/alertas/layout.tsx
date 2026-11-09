import { SubPestanas } from "@/components/admin/SubPestanas";

// Alertas: las que hay hoy en todas las ciudades, y su configuración
// (renombrar, quitar o agregar alertas).
export default function AlertasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubPestanas
        pestanas={[
          { href: "/admin/alertas", label: "Alertas de hoy", exacto: true },
          { href: "/admin/alertas/configurar", label: "Agregar, renombrar o quitar alertas" },
        ]}
      />
      {children}
    </div>
  );
}
