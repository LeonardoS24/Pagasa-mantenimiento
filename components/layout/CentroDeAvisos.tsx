"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Enlace "Mensajes" de la barra superior con su contador, y los avisos de lo
// nuevo: un mensaje que llega o más vencimientos en rojo. Consulta
// /api/avisos cada medio minuto (solo con la pestaña a la vista) y al volver
// a ella. Si la persona activó los avisos del navegador (y el sistema va por
// HTTPS: los navegadores no los permiten en HTTP), salen como notificación
// del sistema operativo; si no, como recuadro dentro de la página.
//
// Lo ya avisado se recuerda en localStorage, así varias pestañas abiertas no
// repiten el mismo aviso.

type Estado = {
  noLeidos: number;
  ultimoMensaje: { id: string; de: string; texto: string; canal: string } | null;
  rojos: number;
};
type Aviso = { id: string; titulo: string; texto: string; href: string };

const CADA_MS = 30_000;
const CLAVE_MENSAJE = "pagasa:ultimo-mensaje-avisado";
const CLAVE_ROJOS = "pagasa:rojos-avisados";

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin localStorage solo se pierde el "ya avisado".
  }
}

function notificar(aviso: Aviso): boolean {
  if (typeof Notification === "undefined" || !window.isSecureContext || Notification.permission !== "granted") return false;
  // Con la pestaña a la vista basta el recuadro; la notificación es para
  // cuando está en otra ventana.
  if (document.visibilityState === "visible") return false;
  try {
    const n = new Notification(aviso.titulo, { body: aviso.texto, tag: aviso.id, icon: "/logos/pagasa.png" });
    n.onclick = () => {
      window.focus();
      window.location.href = aviso.href;
    };
    return true;
  } catch {
    return false;
  }
}

export function CentroDeAvisos() {
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const enMensajes = useRef(false);
  enMensajes.current = pathname.startsWith("/mensajes");

  useEffect(() => {
    let vivo = true;
    const consultar = async () => {
      if (document.visibilityState !== "visible" && typeof Notification !== "undefined" && Notification.permission !== "granted") return;
      try {
        const r = await fetch("/api/avisos", { cache: "no-store", redirect: "manual" });
        if (!r.ok) return; // sesión vencida: de eso se encarga InactividadGuard
        const e = (await r.json()) as Estado;
        if (!vivo) return;
        setEstado(e);
        const nuevos: Aviso[] = [];

        const m = e.ultimoMensaje;
        if (m && leer(CLAVE_MENSAJE) !== m.id) {
          guardar(CLAVE_MENSAJE, m.id);
          if (!enMensajes.current) {
            nuevos.push({
              id: `m-${m.id}`,
              titulo: m.canal === "general" ? `Mensaje de ${m.de} (General)` : `Mensaje de ${m.de}`,
              texto: m.texto,
              href: `/mensajes?con=${encodeURIComponent(m.canal)}`,
            });
          }
        }

        // Rojos: se avisa cuando suben respecto a lo último avisado (si bajan
        // solo se actualiza la cuenta).
        const antes = Number(leer(CLAVE_ROJOS) ?? "NaN");
        if (Number.isNaN(antes)) {
          guardar(CLAVE_ROJOS, String(e.rojos));
        } else if (e.rojos !== antes) {
          guardar(CLAVE_ROJOS, String(e.rojos));
          if (e.rojos > antes) {
            nuevos.push({
              id: `r-${e.rojos}-${Date.now()}`,
              titulo: "Vencimientos en rojo",
              texto: `Ahora hay ${e.rojos} vencimiento(s) a 7 días o menos (antes ${antes}).`,
              href: "/dashboard",
            });
          }
        }

        const enPagina = nuevos.filter((a) => !notificar(a));
        if (enPagina.length) setAvisos((prev) => [...prev, ...enPagina].slice(-3));
      } catch {
        // Sin red: se reintenta en la siguiente vuelta.
      }
    };
    void consultar();
    const t = window.setInterval(consultar, CADA_MS);
    const alVolver = () => document.visibilityState === "visible" && void consultar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  // Los recuadros se van solos a los 12 segundos.
  useEffect(() => {
    if (avisos.length === 0) return;
    const t = window.setTimeout(() => setAvisos((prev) => prev.slice(1)), 12_000);
    return () => window.clearTimeout(t);
  }, [avisos]);

  const noLeidos = estado?.noLeidos ?? 0;

  return (
    <>
      <Link href="/mensajes" className="relative text-blue-100 hover:text-white hover:underline">
        Mensajes
        {noLeidos > 0 && (
          <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-white">{noLeidos > 99 ? "99+" : noLeidos}</span>
        )}
      </Link>
      {avisos.length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 w-80 space-y-2 print:hidden">
          {avisos.map((a) => (
            <div key={a.id} className="rounded-lg border border-primary/30 bg-white p-3 text-sm text-ink shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <Link href={a.href} className="font-semibold text-primary hover:underline" onClick={() => setAvisos((p) => p.filter((x) => x.id !== a.id))}>
                  {a.titulo}
                </Link>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setAvisos((p) => p.filter((x) => x.id !== a.id))}
                  className="text-gray-400 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <p className="mt-1 line-clamp-3 text-gray-600">{a.texto}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
