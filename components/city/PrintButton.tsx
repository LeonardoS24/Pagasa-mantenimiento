"use client";

import { CLASE_PDF_PENDIENTE } from "./PrintPdfPages";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  function imprimir() {
    // Los PDF adjuntos se dibujan página por página al abrir la hoja (ver
    // PrintPdfPages) y eso tarda. Si alguien le da a Imprimir antes de que
    // terminen, esas hojas salen en blanco y no hay forma de notarlo hasta
    // que ya se imprimió: por eso aquí se avisa en vez de mandar a imprimir
    // a medias.
    const pendientes = document.querySelectorAll(`.${CLASE_PDF_PENDIENTE}`).length;
    if (pendientes > 0) {
      window.alert(
        "Todavía se están preparando los archivos adjuntos para imprimir. " +
          "Espera unos segundos a que desaparezca el aviso de “Preparando…” y vuelve a intentar."
      );
      return;
    }
    window.print();
  }

  return (
    <button
      type="button"
      onClick={imprimir}
      className="print:hidden rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark"
    >
      {label}
    </button>
  );
}
