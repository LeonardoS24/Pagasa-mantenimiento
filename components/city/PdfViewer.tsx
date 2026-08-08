"use client";

import { useEffect, useRef, useState } from "react";

const RENDER_TIMEOUT_MS = 30000;

// Antes el PDF se veía con el visor nativo del navegador embebido en un
// iframe: no paginaba bien ahí dentro (quedaba en negro, solo una página).
// Este visor evita el visor nativo por completo: dibuja cada página como
// <canvas> con pdfjs-dist, así que se ve igual en cualquier navegador y se
// queda dentro de esta misma página (con el breadcrumb y "Descargar"
// arriba), sin necesidad de descargar el archivo.
export function PdfViewer({ src, fileName }: { src: string; fileName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    // pdf.js agenda el dibujo de cada página con requestAnimationFrame, que
    // el navegador suspende mientras la pestaña está oculta/en segundo
    // plano: sin este tope, una pestaña que nunca vuelve a primer plano se
    // quedaría en "Cargando..." para siempre.
    const timeout = setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, RENDER_TIMEOUT_MS);

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument({ url: src }).promise;
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mb-4 w-full rounded-lg border border-gray-200 shadow-sm";
          const context = canvas.getContext("2d");
          if (!context) continue;
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          if (cancelled) return;
          containerRef.current.appendChild(canvas);
        }
        if (!cancelled) {
          clearTimeout(timeout);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [src]);

  if (status === "error") {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-ink">
        No se pudo mostrar la vista previa de &quot;{fileName}&quot;. Descárgalo para abrirlo.
      </p>
    );
  }

  return (
    <div>
      {status === "loading" && <p className="mb-3 text-sm text-gray-500">Cargando vista previa…</p>}
      <div ref={containerRef} className="flex flex-col items-center" />
    </div>
  );
}
