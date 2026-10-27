import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUrlBase } from "@/lib/ajustes";
import { descifrarSecreto } from "@/lib/secretos";
import { proximoMomentoProgramado } from "@/lib/reportes-programados";
import { ReportesPanel } from "@/components/admin/ReportesPanel";

// Reporte semanal de vencimientos por correo: a quién se manda, cuándo y con
// qué cuenta de correo (ver lib/reportes-programados.ts).
export default async function AdminReportesPage() {
  await requireAdmin();
  const config = await prisma.configuracionReportes.findUnique({ where: { id: "unico" } });
  const urlBase = await getUrlBase();

  const diaSemana = config?.diaSemana ?? 1;
  const hora = config?.hora ?? 7;
  return (
    <ReportesPanel
      config={{
        activo: config?.activo ?? false,
        destinatarios: config?.destinatarios ?? "",
        diaSemana,
        hora,
        diasAnticipacion: config?.diasAnticipacion ?? 30,
        smtpHost: config?.smtpHost ?? "",
        smtpPuerto: config?.smtpPuerto ?? 465,
        smtpSeguro: config?.smtpSeguro ?? true,
        smtpUsuario: config?.smtpUsuario ?? "",
        remitente: config?.remitente ?? "",
        tieneClave: !!config?.smtpClaveCifrada,
        claveIlegible: !!config?.smtpClaveCifrada && descifrarSecreto(config.smtpClaveCifrada) === null,
        urlBase: urlBase ?? "",
        servidorDelEnv: !!process.env.SMTP_HOST,
        ultimoEnvio: config?.ultimoEnvio?.toISOString() ?? null,
        ultimoError: config?.ultimoError ?? null,
        ultimoResumen: config?.ultimoResumen ?? null,
        avisoRojoActivo: config?.avisoRojoActivo ?? false,
        avisoRojoUltimoResumen: config?.avisoRojoUltimoResumen ?? null,
        proximoEnvio: config?.activo ? proximoMomentoProgramado(new Date(), diaSemana, hora).toISOString() : null,
      }}
    />
  );
}
