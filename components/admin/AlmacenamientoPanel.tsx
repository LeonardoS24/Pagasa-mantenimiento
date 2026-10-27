import { formatBytes, type Almacenamiento } from "@/lib/almacenamiento";

// Cuánto pesa hoy lo que guarda el servidor (ver lib/almacenamiento.ts) y
// qué tamaño de disco externo hace falta para copiarlo.
export function AlmacenamientoPanel({ datos }: { datos: Almacenamiento }) {
  const { baseBytes, uploadsBytes, backupsBytes, discoLibreBytes, discoTotalBytes } = datos;
  // Lo que hay que sacar a un disco externo: la base y los archivos subidos.
  // Los respaldos locales se regeneran, no hace falta copiarlos.
  const datosReales = baseBytes + uploadsBytes;
  const libreProporcion = discoLibreBytes !== null && discoTotalBytes ? discoLibreBytes / discoTotalBytes : null;
  const discoApretado =
    discoLibreBytes !== null && (discoLibreBytes < 10 * 1024 ** 3 || (libreProporcion !== null && libreProporcion < 0.1));

  const filas: [string, string, string][] = [
    ["Base de datos", formatBytes(baseBytes), "Todo el historial, fichas y registros"],
    ["Archivos subidos", formatBytes(uploadsBytes), `${datos.uploadsArchivos.toLocaleString("es-MX")} archivo(s): PDFs, fotos y escaneos`],
    ["Respaldos en este equipo", formatBytes(backupsBytes), `${datos.backupsCantidad} respaldo(s) completo(s) (cada uno repite la base y los archivos)`],
  ];

  return (
    <div className="mb-8 space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-primary">Espacio que ocupa el sistema</h2>

      <table className="w-full text-sm">
        <tbody>
          {filas.map(([nombre, tamano, nota]) => (
            <tr key={nombre} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-4 font-medium text-ink">{nombre}</td>
              <td className="whitespace-nowrap py-2 pr-4 font-semibold text-primary">{tamano}</td>
              <td className="py-2 text-gray-500">{nota}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {datos.uploadsPorCarpeta.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-primary">Qué carpetas de archivos pesan más</summary>
          <ul className="mt-2 space-y-1 text-ink">
            {datos.uploadsPorCarpeta.map((c) => (
              <li key={c.nombre} className="flex justify-between border-b border-gray-100 py-1">
                <span>{c.nombre}</span>
                <span className="text-gray-600">{formatBytes(c.bytes)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {discoLibreBytes !== null && discoTotalBytes !== null && (
        <p className={`rounded-md px-3 py-2 text-sm ${discoApretado ? "bg-red-50 text-red-700" : "bg-gray-50 text-ink"}`}>
          Disco del servidor: {formatBytes(discoLibreBytes)} libres de {formatBytes(discoTotalBytes)}.
          {discoApretado && " Queda poco espacio: libera o amplía el disco antes de que falle un respaldo."}
        </p>
      )}

      <div className="rounded-md bg-yellow-50 px-3 py-3 text-sm text-yellow-900">
        <p className="font-medium">Los respaldos de arriba están en el mismo equipo que el sistema.</p>
        <p className="mt-1">
          Si el disco falla, se pierde todo junto. Por eso existe la <strong>Copia de seguridad servidor</strong> (abajo), que copia
          sola la base y los archivos a una memoria USB: hoy son <strong>{formatBytes(datosReales)}</strong>. Una memoria de{" "}
          <strong>{formatBytes(Math.max(datosReales * 10, 64 * 1024 ** 3))}</strong> o más alcanza para años de crecimiento.
        </p>
      </div>
    </div>
  );
}
