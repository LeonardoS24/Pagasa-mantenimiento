"use client";

import { useEffect, useRef, useState } from "react";

const RENDER_TIMEOUT_MS = 60000;

// Marca que usa PrintButton para saber si todavía falta dibujar algún PDF
// antes de mandar a imprimir (ver components/city/PrintButton.tsx).
export const CLASE_PDF_PENDIENTE = "pdf-impresion-pendiente";

export type PrintablePdf = { id: string; fileName: string };

// Dibuja, debajo de un registro, las páginas de los PDF que se le adjuntaron,
// para que salgan en la MISMA impresión de la hoja de la unidad.
//
// Por qué hace falta: un PDF no se puede incrustar en una página HTML de forma
// que el navegador lo imprima — solo imprime lo que él mismo dibuja. Antes en
// la hoja impresa quedaba únicamente el nombre del archivo, así que la hoja
// archivada no traía las evidencias. Aquí cada página del PDF se dibuja como
// <canvas> con pdfjs-dist (el mismo camino que ya usa PdfViewer), y un canvas
// sí se imprime.
export function PrintPdfPages({ documents }: { documents: PrintablePdf[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // El efecto depende de ESTO y no del arreglo: `documents` se arma con un
  // .map() en la página, así que es un arreglo nuevo en cada render y usarlo
  // como dependencia volvería a dibujar los PDF una y otra vez.
  const idsDocumentos = documents.map((d) => d.id).join(",");

  useEffect(() => {
    if (documents.length === 0) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    // Mismo tope que PdfViewer: pdf.js dibuja con requestAnimationFrame, que
    // el navegador congela si la pestaña está en segundo plano; sin esto se
    // quedaría "preparando" para siempre y bloquearía el botón de imprimir.
    const timeout = setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, RENDER_TIMEOUT_MS);

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        if (!containerRef.current) return;
        containerRef.current.innerHTML = "";

        for (const doc of documents) {
          const pdf = await pdfjsLib.getDocument({ url: `/api/documents/${doc.id}` }).promise;
          if (cancelled || !containerRef.current) return;

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            // 1.5 da una hoja legible al imprimir sin volver gigantesca la
            // página: con muchos PDF adjuntos, una escala mayor hace que el
            // navegador se arrastre al momento de imprimir.
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.className = "mb-2 w-full border border-gray-200 break-inside-avoid";
            const context = canvas.getContext("2d");
            if (!context) continue;
            await page.render({ canvas, canvasContext: context, viewport }).promise;
            if (cancelled || !containerRef.current) return;

            const pie = document.createElement("p");
            pie.className = "mb-4 text-xs text-gray-600";
            pie.textContent =
              pdf.numPages > 1
                ? `${doc.fileName} — página ${pageNum} de ${pdf.numPages}`
                : doc.fileName;

            const bloque = document.createElement("figure");
            bloque.className = "break-inside-avoid";
            bloque.appendChild(canvas);
            bloque.appendChild(pie);
            containerRef.current.appendChild(bloque);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsDocumentos]);

  if (documents.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
        Archivos adjuntos a este registro
      </p>
      {status === "loading" && (
        <p className={`${CLASE_PDF_PENDIENTE} text-xs text-gray-500 print:hidden`}>
          Preparando {documents.length} archivo(s) para imprimir…
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-accent">
          No se pudieron preparar estos archivos para imprimir:{" "}
          {documents.map((d) => d.fileName).join(", ")}. Ábrelos desde el sistema e imprímelos por
          separado.
        </p>
      )}
      <div ref={containerRef} />
    </div>
  );
}
