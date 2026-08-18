"use client";

import { useState, type ReactNode } from "react";

// Para las 5 secciones de registro (Visual Externa, Hermeticidad, Visual
// Interna, Ultrasonido, Hidrostática) cuando la estación/planta tiene varios
// tanques: en vez de apilar los 4 formularios y tablas uno tras otro, se
// elige a qué tanque corresponde el registro y solo se muestra ese. El
// contenido de cada pestaña ya viene armado desde el servidor (formularios y
// tablas), este componente solo decide cuál mostrar.
export function TankTabs({ tabs }: { tabs: { etiqueta: string; content: ReactNode }[] }) {
  const [selected, setSelected] = useState(tabs[0]?.etiqueta ?? "");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.etiqueta}
            type="button"
            onClick={() => setSelected(tab.etiqueta)}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
              selected === tab.etiqueta
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500 hover:text-ink"
            }`}
          >
            {tab.etiqueta}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.etiqueta} className={selected === tab.etiqueta ? "" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
