"use client";

import "@/lib/pdfjs-compat";
import { RECURSOS_PDFJS } from "@/lib/pdfjs-recursos";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

const LOAD_TIMEOUT_MS = 30000;
// Zoom relativo al ancho disponible: 100 % = la página ocupa todo el ancho.
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const ZOOM_INICIAL = 2; // índice de 100 %
// Tope de pixeles por página dibujada (los navegadores fallan o se ponen
// lentos con lienzos enormes, sobre todo Safari y los celulares).
const MAX_PIXELES = 16_000_000;
const MAX_DENSIDAD = 2;

type Pagina = { page: PDFPageProxy; ancho: number; alto: number };

// Antes el PDF se veía con el visor nativo del navegador embebido en un
// iframe: no paginaba bien ahí dentro (quedaba en negro, solo una página).
// Este visor evita el visor nativo por completo: dibuja cada página como
// <canvas> con pdfjs-dist, así que se ve igual en cualquier navegador y se
// queda dentro de esta misma página (con el breadcrumb y "Descargar"
// arriba), sin necesidad de descargar el archivo.
//
// Cómo se dibuja (esto corrige que los PDF se vieran borrosos y desiguales):
// - Cada página se ajusta al ANCHO disponible (no a una escala fija), así un
//   escaneo grande y una hoja carta se ven del mismo tamaño.
// - El lienzo se dibuja con la densidad de la pantalla (devicePixelRatio, hasta
//   2x): en laptops con zoom de Windows al 125-150 % el texto sale nítido.
// - Solo se dibujan las páginas cercanas a lo que se ve; las lejanas se
//   liberan. Un escaneo de 50 hojas ya no se carga entero en memoria.
// - Hay zoom (− / + / Ajustar). Se redibuja si cambia el ancho de la ventana.
export function PdfViewer({ src, fileName }: { src: string; fileName: string }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const proporcionRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [zoomIndice, setZoomIndice] = useState(ZOOM_INICIAL);
  const [anchoBase, setAnchoBase] = useState(0);

  // 1) Abrir el documento.
  useEffect(() => {
    let cancelled = false;
    // pdf.js agenda el dibujo de cada página con requestAnimationFrame, que
    // el navegador suspende mientras la pestaña está oculta/en segundo
    // plano: sin este tope, una pestaña que nunca vuelve a primer plano se
    // quedaría en "Cargando..." para siempre.
    const timeout = setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, LOAD_TIMEOUT_MS);
    let tarea: { destroy: () => Promise<void>; promise: Promise<PDFDocumentProxy> } | null = null;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // El worker se sirve como archivo estático desde /public en vez de
        // dejar que el empaquetador lo resuelva con new URL(..., import.meta.url):
        // ese camino hacía que el minificador del build de producción tratara
        // el worker (que es un módulo ESM) como código suelto y fallara con
        // "'import', and 'export' cannot be used outside of module code".
        // Si se actualiza pdfjs-dist hay que volver a copiar el archivo (ver
        // scripts/copy-pdf-worker.mjs, que corre solo en postinstall).
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        tarea = pdfjsLib.getDocument({ url: src, ...RECURSOS_PDFJS });
        const pdf = await tarea.promise;
        if (cancelled) return;
        clearTimeout(timeout);
        setDocumento(pdf);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      void tarea?.destroy();
    };
  }, [src]);

  // 2) Medir el ancho disponible y volver a medirlo si cambia la ventana
  //    (solo el ancho: en el celular la barra del navegador cambia el alto
  //    al hacer scroll y no hay por qué redibujar).
  useEffect(() => {
    const medir = () => {
      const ancho = contenedorRef.current?.clientWidth ?? 0;
      setAnchoBase((anterior) => (Math.abs(ancho - anterior) > 40 ? ancho : anterior));
    };
    medir();
    let espera: ReturnType<typeof setTimeout> | undefined;
    const alCambiar = () => {
      clearTimeout(espera);
      espera = setTimeout(medir, 250);
    };
    window.addEventListener("resize", alCambiar);
    return () => {
      clearTimeout(espera);
      window.removeEventListener("resize", alCambiar);
    };
  }, []);

  // 3) Armar los marcos de las páginas (con su tamaño final) y dibujar solo
  //    las que se ven o están cerca.
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!documento || !contenedor || anchoBase <= 0) return;

    let cancelled = false;
    const zoom = ZOOMS[zoomIndice];
    const paginas = new Map<HTMLElement, Pagina>();
    const tareas = new Map<HTMLElement, RenderTask>();

    const dibujar = async (marco: HTMLElement) => {
      const pagina = paginas.get(marco);
      if (!pagina || marco.dataset.dibujada) return;
      marco.dataset.dibujada = "1";
      try {
        const escala = (anchoBase / pagina.ancho) * zoom;
        let densidad = Math.min(window.devicePixelRatio || 1, MAX_DENSIDAD);
        const pixeles = pagina.ancho * escala * pagina.alto * escala * densidad * densidad;
        if (pixeles > MAX_PIXELES) densidad *= Math.sqrt(MAX_PIXELES / pixeles);

        const viewport = pagina.page.getViewport({ scale: escala * densidad });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        const contexto = canvas.getContext("2d");
        if (!contexto) {
          delete marco.dataset.dibujada;
          return;
        }
        const render = pagina.page.render({ canvas, canvasContext: contexto, viewport });
        tareas.set(marco, render);
        await render.promise;
        tareas.delete(marco);
        // Si mientras tanto se soltó (se alejó de la vista), no se pinta.
        if (!cancelled && marco.dataset.dibujada) marco.replaceChildren(canvas);
      } catch {
        // Dibujo cancelado al soltar o al cambiar el zoom: no es un error.
        tareas.delete(marco);
      }
    };

    const soltar = (marco: HTMLElement) => {
      tareas.get(marco)?.cancel();
      tareas.delete(marco);
      delete marco.dataset.dibujada;
      marco.replaceChildren();
    };

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const marco = entrada.target as HTMLElement;
          if (entrada.isIntersecting) void dibujar(marco);
          else soltar(marco);
        }
      },
      { rootMargin: "1500px 0px" }
    );

    (async () => {
      try {
        contenedor.replaceChildren();
        for (let numero = 1; numero <= documento.numPages; numero++) {
          const page = await documento.getPage(numero);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const escala = (anchoBase / base.width) * zoom;
          const marco = document.createElement("div");
          marco.className = "mx-auto mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm";
          marco.style.width = `${base.width * escala}px`;
          marco.style.height = `${base.height * escala}px`;
          marco.setAttribute("aria-label", `Página ${numero} de ${documento.numPages}`);
          contenedor.appendChild(marco);
          paginas.set(marco, { page, ancho: base.width, alto: base.height });
          observador.observe(marco);
        }
        if (cancelled) return;
        setStatus("ready");
        // Al cambiar el zoom se vuelve a la misma parte del documento.
        const guardada = proporcionRef.current;
        const scroll = contenedor.closest("main");
        if (guardada !== null && scroll) scroll.scrollTop = guardada * scroll.scrollHeight;
        proporcionRef.current = null;
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      observador.disconnect();
      for (const render of tareas.values()) render.cancel();
      tareas.clear();
    };
  }, [documento, zoomIndice, anchoBase]);

  const cambiarZoom = (nuevo: number) => {
    const limitado = Math.min(Math.max(nuevo, 0), ZOOMS.length - 1);
    if (limitado === zoomIndice) return;
    const scroll = contenedorRef.current?.closest("main");
    proporcionRef.current = scroll && scroll.scrollHeight > 0 ? scroll.scrollTop / scroll.scrollHeight : null;
    setZoomIndice(limitado);
  };

  if (status === "error") {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-ink">
        No se pudo mostrar la vista previa de &quot;{fileName}&quot;. Descárgalo para abrirlo.
      </p>
    );
  }

  const botonClase =
    "rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-ink transition hover:bg-gray-50 disabled:opacity-40";

  return (
    <div>
      <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <button type="button" className={botonClase} onClick={() => cambiarZoom(zoomIndice - 1)} disabled={zoomIndice === 0} aria-label="Alejar">
          −
        </button>
        <span className="w-12 text-center text-sm tabular-nums text-ink" aria-live="polite">
          {Math.round(ZOOMS[zoomIndice] * 100)} %
        </span>
        <button
          type="button"
          className={botonClase}
          onClick={() => cambiarZoom(zoomIndice + 1)}
          disabled={zoomIndice === ZOOMS.length - 1}
          aria-label="Acercar"
        >
          +
        </button>
        <button type="button" className={botonClase} onClick={() => cambiarZoom(ZOOM_INICIAL)} disabled={zoomIndice === ZOOM_INICIAL}>
          Ajustar
        </button>
        {documento && (
          <span className="ml-auto text-xs text-gray-500">
            {documento.numPages} {documento.numPages === 1 ? "página" : "páginas"}
          </span>
        )}
      </div>
      {status === "loading" && <p className="mb-3 text-sm text-gray-500">Cargando vista previa…</p>}
      <div className="overflow-x-auto">
        <div ref={contenedorRef} />
      </div>
    </div>
  );
}
