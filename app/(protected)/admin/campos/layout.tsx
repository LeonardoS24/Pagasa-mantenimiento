import { CamposSubTabs } from "@/components/admin/CamposSubTabs";

// Editar sistema: «Campos y recuadros» (agregar y quitar) y «Acomodar fichas»
// (orden, ancho y color de los recuadros).
export default function CamposLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <CamposSubTabs />
      {children}
    </div>
  );
}
