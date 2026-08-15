import { requireAdmin } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { BackupPanel } from "@/components/admin/BackupPanel";

export default async function AdminRespaldosPage() {
  await requireAdmin();

  const backups = (await listBackups()).map((b) => ({ name: b.name, date: b.date.toISOString() }));

  return <BackupPanel backups={backups} />;
}
