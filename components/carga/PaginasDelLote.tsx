"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Miniaturas de algunas páginas del escaneo original de un lote, para ver de
// un vistazo qué documento se está revisando. Mismo pdfjs-dist que
// components/city/PdfViewer.tsx (worker servido desde /public, ver ahí por
// qué). El PDF se descarga UNA vez por página del sistema aunque haya muchos
// documentos en el lote: todos comparten la misma promesa.
const documentos = new Map<string, Promise<PDFDocumentProxy>>();

function cargarPdf(src: string): Promise<PDFDocumentProxy> {
  let promesa = documentos.get(src);
  if (!promesa) {
    promesa = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjsLib.getDocument({ url: src }).promise;
    })();
    // Si falla (p. ej. se cayó la red), el siguiente intento vuelve a pedirlo.
    promesa.catch(() => documentos.delete(src));
    documentos.set(src, promesa);
  }
  return promesa;
}

const MAX_MINIATURAS = 4;

export function PaginasDelLote({ src, desde, hasta }: { src: string; desde: number; hasta: number }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const ultima = Math.min(hasta, desde + MAX_MINIATURAS - 1);
  const restantes = hasta - ultima;

  useEffect(() => {
    let cancelado = false;
    setEstado("cargando");
    (async () => {
      try {
        const pdf = await cargarPdf(src);
        if (cancelado || !contenedor.current) return;
        contenedor.current.innerHTML = "";
        for (let numero = desde; numero <= Math.min(ultima, pdf.numPages); numero++) {
          const pagina = await pdf.getPage(numero);
          const base = pagina.getViewport({ scale: 1 });
          const viewport = pagina.getViewport({ scale: 260 / base.width });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "w-full rounded border border-gray-200 bg-white shadow-sm";
          canvas.title = `Página ${numero}`;
          const context = canvas.getContext("2d");
          if (!context) continue;
          await pagina.render({ canvas, canvasContext: context, viewport }).promise;
          if (cancelado || !contenedor.current) return;
          const figura = document.createElement("figure");
          const pie = document.createElement("figcaption");
          pie.className = "mt-1 text-center text-xs text-gray-500";
          pie.textContent = `Pág. ${numero}`;
          figura.append(canvas, pie);
          contenedor.current.appendChild(figura);
        }
        if (!cancelado) setEstado("listo");
      } catch (error) {
        console.error("No se pudo dibujar la vista previa del lote:", error);
        if (!cancelado) setEstado("error");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [src, desde, ultima]);

  return (
    <div>
      {estado === "cargando" && <p className="mb-2 text-xs text-gray-500">Cargando páginas…</p>}
      {estado === "error" && (
        <p className="mb-2 text-xs text-gray-500">No se pudo mostrar la vista previa; ábrela con el enlace de abajo.</p>
      )}
      <div ref={contenedor} className="grid grid-cols-2 gap-2" />
      <a
        href={`${src}#page=${desde}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
      >
        {restantes > 0 ? `Ver las ${hasta - desde + 1} páginas en el escaneo` : "Abrir en el escaneo completo"} ↗
      </a>
    </div>
  );
}
