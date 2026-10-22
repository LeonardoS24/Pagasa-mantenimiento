/** @type {import('next').NextConfig} */
// Encabezados de seguridad en todas las respuestas. HSTS solo cuando el
// sistema ya se sirve por https (COOKIE_SECURE=true, ver .env.example): por
// http el navegador lo ignora, pero ponerlo antes de tener https dejaría
// trabado el acceso si luego se cambia de dirección.
const encabezadosSeguridad = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.COOKIE_SECURE === "true"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: encabezadosSeguridad }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // Habilita instrumentation.ts (ver lib/backup.ts): ahí se agenda el
    // respaldo automático de la base y de uploads/ al arrancar el servidor.
    instrumentationHook: true,
    // En modo producción (next start) el navegador se queda con una copia de
    // cada página por 30 segundos. Eso hacía que al guardar una ficha técnica
    // el dato SÍ entrara a la base pero la pantalla siguiera mostrando el
    // valor anterior, y pareciera que no se había guardado (pasó el 17 de
    // agosto de 2026, con gente recapturando lo mismo dos veces). En modo
    // desarrollo no ocurre, por eso nunca se había visto.
    //
    // Con 0 el navegador vuelve a pedir la página en cada navegación. Este
    // sistema corre en la red local y con pocos usuarios: que el dato se vea
    // al instante importa mucho más que ahorrarse esa recarga.
    staleTimes: { dynamic: 0, static: 0 },
  },
  webpack: (config) => {
    // pdfjs intenta usar el paquete "canvas" de Node cuando corre del lado
    // del servidor; en el navegador dibuja sobre un <canvas> real, así que
    // aquí sobra y solo rompe el empaquetado.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
