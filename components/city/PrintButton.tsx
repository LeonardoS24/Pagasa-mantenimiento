"use client";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
    >
      {label}
    </button>
  );
}
