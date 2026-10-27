import { requireAdmin } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { getAlmacenamiento } from "@/lib/almacenamiento";
import {
  HORAS_PARA_AVISO,
  getEstadoExterno,
  getProgresoExterno,
  getRutaExterna,
  listarUnidades,
} from "@/lib/respaldo-externo";
import { BackupPanel } from "@/components/admin/BackupPanel";
import { AlmacenamientoPanel } from "@/components/admin/AlmacenamientoPanel";
import { CopiaExternaPanel } from "@/components/admin/CopiaExternaPanel";

export default async function AdminRespaldosPage() {
  await requireAdmin();

  const backups = (await listBackups()).map((b) => ({ name: b.name, date: b.date.toISOString() }));
  const [almacenamiento, ruta, unidades, estado] = await Promise.all([
    getAlmacenamiento(),
    getRutaExterna(),
    listarUnidades(),
    getEstadoExterno(),
  ]);

  return (
    <>
      <AlmacenamientoPanel datos={almacenamiento} />
      <CopiaExternaPanel
        ruta={ruta}
        unidades={unidades}
        estadoInicial={estado}
        progresoInicial={getProgresoExterno()}
        horasParaAviso={HORAS_PARA_AVISO}
      />
      <BackupPanel backups={backups} />
    </>
  );
}
