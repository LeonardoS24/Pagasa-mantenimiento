"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { enviarMensaje } from "@/actions/mensajes-actions";
import type { Conversacion } from "@/lib/mensajes";

type Mensaje = { id: string; deUserId: string | null; de: string; texto: string; fecha: string };

const CADA_MS = 4000;
const TEXTO_MAX = 2000;

function hora(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Las rutas del sistema que alguien pega ("/ciudades/hermosillo/vehiculo/...")
// salen como enlace. Nada más: el texto se pinta como texto (React lo
// escapa), nunca como HTML.
function ConEnlaces({ texto }: { texto: string }) {
  const partes = texto.split(/(\/(?:ciudades|dashboard|mensajes|buscar|admin)\/?[^\s]*)/g);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <Link key={i} href={p} className="underline">
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function ActivarAvisos() {
  const [permiso, setPermiso] = useState<string>("cargando");
  useEffect(() => {
    if (typeof Notification === "undefined") setPermiso("no-soportado");
    else if (!window.isSecureContext) setPermiso("sin-https");
    else setPermiso(Notification.permission);
  }, []);
  if (permiso === "cargando" || permiso === "granted") return null;
  if (permiso === "no-soportado") return null;
  if (permiso === "sin-https") {
    return (
      <p className="text-xs text-gray-500">
        Los avisos del navegador (fuera de esta pestaña) necesitan que el sistema vaya por HTTPS. Mientras, los avisos salen
        dentro de la página.
      </p>
    );
  }
  if (permiso === "denied") {
    return <p className="text-xs text-gray-500">Los avisos del navegador están bloqueados para este sitio (se cambia en el candado de la barra de direcciones).</p>;
  }
  return (
    <button
      type="button"
      onClick={async () => setPermiso(await Notification.requestPermission())}
      className="rounded-md border border-primary px-3 py-1 text-xs text-primary hover:bg-primary/5"
    >
      Activar avisos del navegador
    </button>
  );
}

export function ChatPanel({
  userId,
  conversaciones,
  canalInicial,
  abrirConversacion,
}: {
  userId: string;
  conversaciones: Conversacion[];
  canalInicial: string;
  // En celular se ve la lista o la conversación, no las dos: si la página se
  // abrió con ?con= (desde un aviso), directo a la conversación.
  abrirConversacion: boolean;
}) {
  const router = useRouter();
  const [canal, setCanal] = useState(canalInicial);
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();
  const [filtro, setFiltro] = useState("");
  const [vistaMovil, setVistaMovil] = useState<"lista" | "chat">(abrirConversacion ? "chat" : "lista");
  const final = useRef<HTMLDivElement>(null);
  const actual = conversaciones.find((c) => c.canal === canal) ?? conversaciones[0];

  const cargar = useCallback(async (c: string) => {
    try {
      const r = await fetch(`/api/mensajes?canal=${encodeURIComponent(c)}`, { cache: "no-store", redirect: "manual" });
      if (!r.ok) return;
      const datos = (await r.json()) as { mensajes: Mensaje[] };
      setMensajes((prev) => (prev && prev.length === datos.mensajes.length && prev.at(-1)?.id === datos.mensajes.at(-1)?.id ? prev : datos.mensajes));
    } catch {
      // Sin red: se reintenta.
    }
  }, []);

  useEffect(() => {
    setMensajes(null);
    void cargar(canal);
    const t = window.setInterval(() => document.visibilityState === "visible" && void cargar(canal), CADA_MS);
    return () => window.clearInterval(t);
  }, [canal, cargar]);

  // Al llegar mensajes nuevos, baja al último.
  const ultimoId = mensajes?.at(-1)?.id;
  useEffect(() => {
    final.current?.scrollIntoView({ block: "end" });
  }, [ultimoId]);

  const elegir = (c: string) => {
    setCanal(c);
    setVistaMovil("chat");
    setError(null);
    window.history.replaceState(null, "", `/mensajes?con=${encodeURIComponent(c)}`);
    // La lista de la izquierda (no leídos) se refresca del servidor.
    router.refresh();
  };

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    setError(null);
    startEnviar(async () => {
      const r = await enviarMensaje(canal, limpio);
      if (r.error) {
        setError(r.error);
        return;
      }
      setTexto("");
      await cargar(canal);
      router.refresh();
    });
  };

  const visibles = conversaciones.filter((c) => !filtro || c.titulo.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[420px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white md:flex-row">
      {/* Conversaciones */}
      <aside className={`min-h-0 flex-1 flex-col md:flex md:w-72 md:flex-none md:border-r md:border-gray-200 ${vistaMovil === "lista" ? "flex" : "hidden"}`}>
        <div className="space-y-2 border-b border-gray-100 p-3">
          <h1 className="text-lg font-semibold text-primary">Mensajes</h1>
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar persona..."
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <ActivarAvisos />
        </div>
        <ul className="flex-1 overflow-y-auto">
          {visibles.map((c) => (
            <li key={c.canal}>
              <button
                type="button"
                onClick={() => elegir(c.canal)}
                className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  c.canal === canal ? "bg-primary/5" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{c.titulo}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {c.ultimo ? `${c.ultimo.de}: ${c.ultimo.texto}` : c.subtitulo ?? "Sin mensajes"}
                  </span>
                </span>
                {c.noLeidos > 0 && c.canal !== canal && (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-white">{c.noLeidos}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Conversación */}
      <section className={`min-h-0 flex-1 flex-col md:flex ${vistaMovil === "chat" ? "flex" : "hidden"}`}>
        <header className="border-b border-gray-100 px-4 py-2">
          <button type="button" onClick={() => setVistaMovil("lista")} className="mb-1 text-xs text-primary hover:underline md:hidden">
            ← Conversaciones
          </button>
          <p className="font-semibold text-primary">{actual?.titulo}</p>
          {actual?.subtitulo && <p className="text-xs text-gray-500">{actual.subtitulo}</p>}
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
          {mensajes === null ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : mensajes.length === 0 ? (
            <p className="text-sm text-gray-500">
              Todavía no hay mensajes aquí. {canal === "general" ? "Lo que escribas lo ven todos." : "Solo los ven ustedes dos."}
            </p>
          ) : (
            mensajes.map((m) => {
              const mio = m.deUserId === userId;
              return (
                <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${mio ? "bg-primary text-white" : "bg-white text-ink"}`}>
                    {!mio && <p className="text-xs font-semibold text-primary">{m.de}</p>}
                    <p className="whitespace-pre-wrap break-words">
                      <ConEnlaces texto={m.texto} />
                    </p>
                    <p className={`mt-0.5 text-right text-[10px] ${mio ? "text-blue-100" : "text-gray-400"}`}>{hora(m.fecha)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={final} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="border-t border-gray-100 p-3"
        >
          <div className="flex gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              maxLength={TEXTO_MAX}
              rows={2}
              placeholder="Escribe un mensaje (Enter envía, Shift+Enter cambia de línea)"
              className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {enviando ? "..." : "Enviar"}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </form>
      </section>
    </div>
  );
}
