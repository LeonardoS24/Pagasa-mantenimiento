"use client";

export function ImprimirEtiquetasButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-dark print:hidden"
    >
      Imprimir etiquetas
    </button>
  );
}
