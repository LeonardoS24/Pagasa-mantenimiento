"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { darVistoBueno, quitarVistoBueno } from "@/actions/visto-bueno-actions";
import { modificadoDespues, type EntidadVistoBueno, type VistoBuenoVista } from "@/lib/visto-bueno-tipos";

// Visto bueno de supervisor en cada registro de bitácora de la unidad. La
// página de la unidad carga todos los de esa unidad una vez y los reparte con
// este contexto, para que cada renglón (diez tipos distintos) solo tenga que
// poner <VistoBuenoInsignia> y <VistoBuenoControl>.

type Contexto = { vistos: Record<string, VistoBuenoVista>; userId: string; puedeRevisar: boolean; esAdmin: boolean };
const Ctx = createContext<Contexto | null>(null);

export function VistosBuenosProvider({ children, ...valor }: Contexto & { children: React.ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

// La línea que se ve aunque el registro esté cerrado.
export function VistoBuenoInsignia({
  entidad,
  registroId,
  actualizadoEl,
}: {
  entidad: EntidadVistoBueno;
  registroId: string;
  actualizadoEl?: Date | string | null;
}) {
  const ctx = useContext(Ctx);
  const vb = ctx?.vistos[`${entidad}:${registroId}`];
  if (!vb) return null;
  if (modificadoDespues(vb, actualizadoEl)) {
    return <p className="mt-1 text-xs font-medium text-amber-700">⚠ Modificado después del visto bueno de {vb.username}: falta revisarlo otra vez</p>;
  }
  return (
    <p className="mt-1 text-xs font-medium text-green-700">
      ✓ Visto bueno de {vb.username} · {fecha(vb.fecha)}
    </p>
  );
}

// Dentro del registro abierto: dar o quitar el visto bueno.
export function VistoBuenoControl({
  entidad,
  registroId,
  creadoPorId,
  actualizadoEl,
}: {
  entidad: EntidadVistoBueno;
  registroId: string;
  creadoPorId: string | null;
  actualizadoEl?: Date | string | null;
}) {
  const ctx = useContext(Ctx);
  const router = useRouter();
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, start] = useTransition();
  if (!ctx) return null;
  const vigente = ctx.vistos[`${entidad}:${registroId}`];
  const modificado = vigente ? modificadoDespues(vigente, actualizadoEl) : false;
  // Si se editó después de aprobarlo, se puede (y debe) volver a revisar.
  const vb = modificado ? undefined : vigente;

  if (vb) {
    const puedeQuitar = vb.userId === ctx.userId || ctx.esAdmin;
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
        <p>
          ✓ Revisado por <span className="font-medium">{vb.username}</span> el {fecha(vb.fecha)}
        </p>
        {vb.comentario && <p className="text-xs italic">«{vb.comentario}»</p>}
        {puedeQuitar && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              start(async () => {
                const r = await quitarVistoBueno(entidad, registroId);
                if (r.error) setError(r.error);
                else router.refresh();
              })
            }
            className="mt-1 text-xs text-green-800 underline disabled:opacity-60"
          >
            Quitar visto bueno
          </button>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  const avisoModificado = modificado && vigente && (
    <p className="w-full text-xs text-amber-700">
      Tenía visto bueno de {vigente.username} el {fecha(vigente.fecha)}, pero se modificó después.
    </p>
  );
  if (!ctx.puedeRevisar) return avisoModificado || null;
  if (creadoPorId && creadoPorId === ctx.userId) {
    return (
      <div className="space-y-1">
        {avisoModificado}
        <p className="text-xs text-gray-500">Este registro lo capturaste tú: el visto bueno lo da otra persona.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2">
      {avisoModificado}
      <input
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={500}
        placeholder="Comentario (opcional)"
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
      />
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await darVistoBueno(entidad, registroId, comentario);
            if (r.error) setError(r.error);
            else router.refresh();
          })
        }
        className="rounded-md bg-green-700 px-3 py-1 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
      >
        {pendiente ? "Guardando..." : "Dar visto bueno"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
