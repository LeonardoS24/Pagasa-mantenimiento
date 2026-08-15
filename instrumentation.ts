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
  }
}
