import { requireAdmin } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { getAlmacenamiento } from "@/lib/almacenamiento";
import { BackupPanel } from "@/components/admin/BackupPanel";
import { AlmacenamientoPanel } from "@/components/admin/AlmacenamientoPanel";

export default async function AdminRespaldosPage() {
  await requireAdmin();

  const backups = (await listBackups()).map((b) => ({ name: b.name, date: b.date.toISOString() }));
  const almacenamiento = await getAlmacenamiento();

  return (
    <>
      <AlmacenamientoPanel datos={almacenamiento} />
      <BackupPanel backups={backups} />
    </>
  );
}
