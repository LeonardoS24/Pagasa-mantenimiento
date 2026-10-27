// Se ejecuta una sola vez, justo al arrancar el servidor (Next.js llama a
// este "register" automáticamente; ver instrumentationHook en
// next.config.mjs). Aquí es donde agenda el respaldo automático de la base
// y de uploads/ (ver lib/backup.ts) — no hay tareas programadas en este
// sistema, así que es el único lugar donde algo corre "solo" sin que alguien
// visite una página.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scheduleBackups } = await import("./lib/backup");
    scheduleBackups();
    // Copia a la memoria USB ("Copia de seguridad servidor", ver
    // /admin/respaldos y lib/respaldo-externo.ts).
    const { scheduleRespaldoExterno } = await import("./lib/respaldo-externo");
    scheduleRespaldoExterno();
    // Reporte semanal de vencimientos por correo (ver /admin/reportes).
    const { scheduleReportes } = await import("./lib/reportes-programados");
    scheduleReportes();
    // Plazos normativos (ver /admin/normas): se cargan al arrancar para que
    // las alertas nunca calculen con los valores base cuando el ADMIN ya
    // ajustó alguno.
    const { cargarPlazos } = await import("./lib/requisitos-runtime");
    cargarPlazos().catch((error) => console.error("No se pudieron cargar los plazos normativos:", error));
  }
}
